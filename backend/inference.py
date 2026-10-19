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

    def predict(self, image: Path, quality: list[str], top_k: int):
        if not self.manifest:
            return {"status": "insufficient_information", "reason": "model_unavailable", "candidates": [],
                    "ood": {"detected": None, "score": None, "method": "not_evaluated"}}
        m = self.manifest
        with Image.open(image) as im:
            rgb = ImageOps.pad(im.convert("RGB"), (m.input_size, m.input_size), color=(127, 127, 127))
            tensor = np.asarray(rgb, dtype=np.float32) / 255
        tensor = ((tensor - np.array(m.mean, dtype=np.float32)) / np.array(m.std, dtype=np.float32)).transpose(2, 0, 1)[None]
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
