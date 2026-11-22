from types import SimpleNamespace

import numpy as np
import pytest

pytest.importorskip('ultralytics', reason='Requires optional training dependencies')

from backend.classifier import ExperimentalClassifier
from backend.main import create_app


def test_native_probabilities_are_not_softmaxed_again(tmp_path, monkeypatch):
    checkpoint = tmp_path / 'best.pt'
    checkpoint.write_bytes(b'fixture')
    calls = []
    class Model:
        task = 'classify'
        names = {0: 'a', 1: 'b'}
        def predict(self, **kwargs):
            calls.append(kwargs)
            return [SimpleNamespace(probs=SimpleNamespace(data=SimpleNamespace(
                cpu=lambda: SimpleNamespace(numpy=lambda: np.array([.95, .05])))))]
    monkeypatch.setattr('backend.classifier.YOLO', lambda *a, **kw: Model())
    classifier = ExperimentalClassifier(str(checkpoint), {'a', 'b'})
    result = classifier.predict(tmp_path / 'image.jpg', [], 2)
    assert result['status'] == 'identified'
    assert result['candidates'][0] == {'species_id': 'a', 'confidence': .95}
    assert result['ood']['detected'] is None
    assert 'not calibrated' in result['confidence_explanation']
    assert calls[0]['imgsz'] == 224
    assert classifier.predict(tmp_path / 'image.jpg', ['underexposed'], 2)['reason'] == 'poor_image_quality'
    with pytest.raises(ValueError, match='registered species'):
        ExperimentalClassifier(str(checkpoint), {'a'})


def test_experimental_checkpoint_is_blocked_in_production(settings):
    from fastapi.testclient import TestClient
    settings.app_env = 'production'
    settings.experimental_classifier = 'best.pt'
    with pytest.raises(RuntimeError, match='local development only'):
        with TestClient(create_app(settings)):
            pass
