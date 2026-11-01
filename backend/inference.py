import hashlib
import json
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps

from .schemas import ModelManifest


class Inference:
    """An absent model always abstains. No synthetic identification scores."""

    def __init__(self, manifest_path: str, species_ids: set[str]):
        self.manifest = None
        self.session = None
        if not manifest_path:
            return
        path = Path(manifest_path).resolve()
        manifest = ModelManifest.model_validate_json(path.read_text())
        model = (path.parent / manifest.model_file).resolve()
        if not model.is_relative_to(path.parent) or not model.is_file():
            raise ValueError("Model must be a file inside its bundle directory")
        if not manifest.approved_for_release:
            raise ValueError("Model bundle has not been approved for release")
        if len(set(manifest.species_ids)) != len(manifest.species_ids) or not set(manifest.species_ids) <= species_ids:
            raise ValueError("Model labels must be unique, known species IDs")
        if any(s <= 0 for s in manifest.std):
            raise ValueError("Normalization standard deviations must be positive")
        if hashlib.sha256(model.read_bytes()).hexdigest() != manifest.sha256:
            raise ValueError("Model checksum mismatch")
        import onnxruntime as ort
        options = ort.SessionOptions()
        options.intra_op_num_threads = 2
        self.session = ort.InferenceSession(str(model), sess_options=options, providers=["CPUExecutionProvider"])
        self.manifest = manifest
        self._logits(np.zeros((1, 3, manifest.input_size, manifest.input_size), dtype=np.float32))

    def info(self):
        return {"available": self.manifest is not None,
                "version": self.manifest.version if self.manifest else "unavailable",
                "species_ids": self.manifest.species_ids if self.manifest else [],
                "dataset_version": self.manifest.dataset_version if self.manifest else None}

    def _logits(self, tensor):
        logits = np.asarray(self.session.run(None, {self.session.get_inputs()[0].name: tensor})[0])
        if logits.shape != (1, len(self.manifest.species_ids)) or not np.isfinite(logits).all():
            raise ValueError("Model output must be finite logits with shape [1, class_count]")
        return logits[0].astype(np.float64)

    @staticmethod
    def _iou(left, right):
        x1 = max(left[0], right[0])
        y1 = max(left[1], right[1])
        x2 = min(left[2], right[2])
        y2 = min(left[3], right[3])
        intersection = max(0.0, x2 - x1) * max(0.0, y2 - y1)
        area_left = max(0.0, left[2] - left[0]) * max(0.0, left[3] - left[1])
        area_right = max(0.0, right[2] - right[0]) * max(0.0, right[3] - right[1])
        return intersection / (area_left + area_right - intersection) if area_left + area_right > intersection else 0.0

    def _detections(self, tensor):
        output = np.asarray(self.session.run(None, {self.session.get_inputs()[0].name: tensor})[0])
        class_count = len(self.manifest.species_ids)
        if output.shape == (1, 4 + class_count, 0) or output.ndim != 3 or output.shape[0] != 1:
            raise ValueError("Detector output must have shape [1, 4 + class_count, detection_count]")
        if output.shape[1] != 4 + class_count or not np.isfinite(output).all():
            raise ValueError("Detector output must be finite with four box coordinates and class scores")
        candidates = []
        for detection in output[0].T:
            scores = detection[4:]
            class_index = int(np.argmax(scores))
            score = float(scores[class_index])
            if score < self.manifest.confidence_threshold:
                continue
            center_x, center_y, width, height = map(float, detection[:4])
            box = (center_x - width / 2, center_y - height / 2,
                   center_x + width / 2, center_y + height / 2)
            candidates.append((score, class_index, box))
        candidates.sort(reverse=True, key=lambda item: item[0])
        kept = []
        for candidate in candidates:
            if all(candidate[1] != prior[1] or self._iou(candidate[2], prior[2]) < self.manifest.iou_threshold
                   for prior in kept):
                kept.append(candidate)
            if len(kept) >= self.manifest.max_detections:
                break
        return kept

    def predict(self, image: Path, quality: list[str], top_k: int):
        if not self.manifest:
            return {"status": "insufficient_information", "reason": "model_unavailable", "candidates": [],
                    "ood": {"detected": None, "score": None, "method": "not_evaluated"}}
        m = self.manifest
        with Image.open(image) as im:
            rgb = ImageOps.pad(im.convert("RGB"), (m.input_size, m.input_size), color=(127, 127, 127))
            tensor = np.asarray(rgb, dtype=np.float32) / 255
        tensor = ((tensor - np.array(m.mean, dtype=np.float32)) / np.array(m.std, dtype=np.float32)).transpose(2, 0, 1)[None]
        if getattr(m, "task", "classification") == "detection":
            detections = self._detections(tensor)
            if not detections:
                return {"status": "insufficient_information", "reason": "no_crab_detected", "candidates": [],
                        "ood": {"detected": None, "score": None, "method": "not_evaluated"}}
            best_by_class = {}
            for score, class_index, _ in detections:
                best_by_class[class_index] = max(score, best_by_class.get(class_index, 0.0))
            order = sorted(best_by_class, key=best_by_class.get, reverse=True)
            bad_quality = any(q in quality for q in ["underexposed", "overexposed", "possible_blur_or_low_detail"])
            uncertain = best_by_class[order[0]] < m.confidence_threshold
            reason = "poor_image_quality" if bad_quality else "ambiguous_species" if uncertain else None
            return {"status": "insufficient_information" if reason else "identified", "reason": reason,
                    "candidates": [{"species_id": m.species_ids[i], "confidence": round(best_by_class[i], 5)}
                                   for i in order[:top_k]],
                    "ood": {"detected": None, "score": None, "method": "not_evaluated"}}
        logits = self._logits(tensor)
        scaled = logits / m.temperature
        exps = np.exp(scaled - scaled.max())
        probabilities = exps / exps.sum()
        energy = float(-(logits.max() + np.log(np.exp(logits - logits.max()).sum())))
        order = np.argsort(-probabilities)
        ood = energy > m.energy_threshold
        bad_quality = any(q in quality for q in ["underexposed", "overexposed", "possible_blur_or_low_detail"])
        uncertain = probabilities[order[0]] < m.confidence_threshold or probabilities[order[0]] - probabilities[order[1]] < m.margin_threshold
        reason = "out_of_distribution" if ood else "poor_image_quality" if bad_quality else "ambiguous_species" if uncertain else None
        return {"status": "insufficient_information" if reason else "identified", "reason": reason,
                "candidates": [{"species_id": m.species_ids[i], "confidence": round(float(probabilities[i]), 5)} for i in order[:top_k]],
                "ood": {"detected": bool(ood), "score": round(energy, 5), "method": "logit_energy", "threshold": m.energy_threshold}}
