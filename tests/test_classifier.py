from types import SimpleNamespace
from pathlib import Path

import numpy as np
import pytest

pytest.importorskip('ultralytics', reason='Requires optional training dependencies')

from backend.classifier import ExperimentalClassifier
from backend.main import create_app
from backend.config import Settings


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


@pytest.mark.parametrize('configuration', ['example', 'missing', 'legacy_blank'])
def test_fresh_checkout_uses_bundled_checkpoint(tmp_path, monkeypatch, configuration):
    from fastapi.testclient import TestClient

    root = Path(__file__).resolve().parents[1]
    monkeypatch.chdir(tmp_path)
    env_file = root / '.env.example' if configuration == 'example' else tmp_path / '.env'
    if configuration == 'legacy_blank':
        env_file.write_text('EXPERIMENTAL_CLASSIFIER=\n')
    settings = Settings(
        _env_file=env_file,
        data_dir=tmp_path,
        database_url=f"sqlite:///{tmp_path / 'fresh.db'}",
    )
    assert (root / settings.experimental_classifier).is_file()
    with TestClient(create_app(settings)) as client:
        inference = client.app.state.inference
        assert inference.info()['available'] is True
        assert len(inference.info()['species_ids']) == 8
        image = root / 'public/images/species/scylla-serrata.jpg'
        result = inference.predict(image, [], 3)
        assert len(result['candidates']) == 3
        assert result['reason'] != 'model_unavailable'
        assert all(0 <= item['confidence'] <= 1 for item in result['candidates'])


def test_bundled_model_selection_respects_other_modes():
    assert Settings(_env_file=None, app_env='production').experimental_classifier == ''
    assert Settings(_env_file=None, use_bundled_classifier=False).experimental_classifier == ''
    assert Settings(_env_file=None, model_manifest='approved.json').experimental_classifier == ''
