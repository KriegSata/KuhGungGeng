"""Local experimental YOLO classifier using its native preprocessing."""
import hashlib
from pathlib import Path
import threading

from ultralytics import YOLO


class ExperimentalClassifier:
    def __init__(self, checkpoint: str, species_ids: set[str]):
        path = Path(checkpoint).resolve()
        if not path.is_file():
            raise FileNotFoundError(f'Trained checkpoint is missing: {path}. Pull the latest repository including best.pt; no retraining is required.')
        self.model = YOLO(str(path), task='classify')
        if self.model.task != 'classify':
            raise ValueError('Experimental checkpoint must be a classifier')
        self.labels = [self.model.names[i] for i in range(len(self.model.names))]
        if len(set(self.labels)) != len(self.labels) or not set(self.labels) <= species_ids:
            raise ValueError('Classifier labels must be unique, registered species IDs')
        self.version = 'experimental-yolov8-cls-' + hashlib.sha256(path.read_bytes()).hexdigest()[:12]
        self.lock = threading.Lock()

    def info(self):
        return dict(available=True, version=self.version, species_ids=self.labels,
                    dataset_version='crabs-folder-split-seed42', experimental=True,
                    approved_for_release=False)

    def predict(self, image: Path, quality: list[str], top_k: int):
        # Ultralytics owns resize/center-crop, RGB conversion, scaling, and softmax.
        # Its predictor retains mutable state, so serialize access across requests.
        with self.lock:
            result = self.model.predict(source=str(image), imgsz=224, device='cpu', verbose=False)[0]
            scores = result.probs.data.cpu().numpy()
        order = scores.argsort()[::-1]
        bad_quality = any(q in quality for q in ['underexposed', 'overexposed', 'possible_blur_or_low_detail'])
        uncertain = scores[order[0]] < .7 or scores[order[0]] - scores[order[1]] < .15
        reason = 'poor_image_quality' if bad_quality else 'ambiguous_species' if uncertain else None
        return dict(status='insufficient_information' if reason else 'identified', reason=reason,
                    candidates=[dict(species_id=self.labels[i], confidence=round(float(scores[i]), 5)) for i in order[:top_k]],
                    ood=dict(detected=None, score=None, method='not_evaluated'),
                    experimental=True,
                    confidence_explanation='Experimental classifier: scores compare the eight trained species and are not calibrated probabilities. Unknown species may still receive high scores. These results do not establish food safety.')
