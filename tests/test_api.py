import io
import time
from fastapi.testclient import TestClient
from PIL import Image
from sqlalchemy import select
from backend.cleanup import cleanup
from backend.db import Audit, Feedback, Upload


def upload(client, photo):
    response = client.post('/api/uploads', files={'file': ('crab.jpg', photo, 'image/jpeg')})
    assert response.status_code == 201, response.text
    return response.json()['id']


def predict(client, photo):
    response = client.post('/api/predictions', json={'upload_id': upload(client, photo)})
    assert response.status_code == 201, response.text
    return response.json()


def test_no_model_abstains_without_fabricated_scores(client, photo):
    result = predict(client, photo)
    assert result['status'] == 'insufficient_information'
    assert result['reason'] == 'model_unavailable'
    assert result['candidates'] == []
    assert result['ood']['detected'] is None
    assert 'Do not consume' in result['safety_disclaimer']
    assert client.get('/api/model').json()['available'] is False


def test_exif_removed_and_photo_private(client, photo):
    identity = upload(client, photo)
    response = client.get(f'/api/uploads/{identity}/image')
    with Image.open(io.BytesIO(response.content)) as image:
        assert not image.getexif()
    client.cookies.clear()
    assert client.get(f'/api/uploads/{identity}/image').status_code == 401


def test_session_isolation(client, photo):
    result = predict(client, photo)
    client.cookies.clear()
    client.headers['X-CSRF-Token'] = client.get('/api/session').json()['csrf_token']
    assert client.get(f"/api/predictions/{result['id']}").status_code == 404
    assert client.get('/api/predictions').json()['items'] == []
    assert client.post('/api/predictions', json={'upload_id': result['upload_id']}).status_code == 404
    assert client.delete(f"/api/predictions/{result['id']}").status_code == 404


def test_csrf_and_origin(client, photo):
    client.headers['X-CSRF-Token'] = 'invalid'
    assert client.post('/api/uploads', files={'file': ('a.jpg', photo, 'image/jpeg')}).status_code == 403
    assert client.post('/api/predictions', headers={'origin':'https://evil.example'}, json={}).status_code == 403


def test_invalid_image_and_mime(client):
    assert client.post('/api/uploads', files={'file': ('a.svg', b'<svg/>', 'image/svg+xml')}).status_code == 415
    assert client.post('/api/uploads', files={'file': ('a.jpg', b'not an image', 'image/jpeg')}).status_code == 422
    assert client.post('/api/uploads', files={'file': ('a.jpg', b'', 'image/jpeg')}).status_code == 422


def test_too_small_and_oversized(client):
    stream = io.BytesIO()
    Image.new('RGB', (100, 100)).save(stream, 'PNG')
    assert client.post('/api/uploads', files={'file': ('a.png', stream.getvalue(), 'image/png')}).status_code == 422
    assert client.post('/api/uploads', files={'file': ('a.jpg', b'x' * (10*1024*1024+1), 'image/jpeg')}).status_code == 413


def test_animated_image_rejected(client):
    stream = io.BytesIO()
    Image.new('RGB', (300,300), 'red').save(stream, 'WEBP', save_all=True, append_images=[Image.new('RGB',(300,300),'blue')], duration=100, loop=0)
    assert client.post('/api/uploads', files={'file': ('a.webp', stream.getvalue(), 'image/webp')}).status_code == 415


def test_feedback_requires_review_and_does_not_train(client, photo):
    result = predict(client, photo)
    response = client.post('/api/feedback', json={'prediction_id': result['id'], 'note':'The claw markings suggest another species.'})
    assert response.status_code == 201
    identity = response.json()['id']
    assert response.json()['training_eligible'] is False
    assert client.get('/api/admin/reviews').status_code == 403
    headers = {'X-Admin-Key':'test-reviewer-key'}
    assert len(client.get('/api/admin/reviews',headers=headers).json()['items']) == 1
    reviewed = client.post(f'/api/admin/reviews/{identity}', headers=headers, json={'decision':'accepted','note':'Requires a dorsal photograph and expert label.'})
    assert reviewed.status_code == 200
    assert reviewed.json()['training_eligible'] is False
    assert client.post(f'/api/admin/reviews/{identity}', headers=headers, json={'decision':'accepted','note':'Second reviewer update'}).status_code == 409
    with client.app.state.sessions() as db:
        assert len(db.scalars(select(Audit)).all()) == 1


def test_deletion_removes_feedback_photo_and_prediction(client, photo, settings):
    result = predict(client, photo)
    client.post('/api/feedback',json={'prediction_id':result['id'],'note':'Please review this image.'})
    assert client.delete(f"/api/predictions/{result['id']}").status_code == 204
    assert client.get(f"/api/predictions/{result['id']}").status_code == 404
    assert list((settings.data_dir/'uploads').iterdir()) == []
    with client.app.state.sessions() as db:
        assert db.scalars(select(Feedback)).all() == []


def test_expiry_and_cleanup(client, photo, settings):
    identity = upload(client, photo)
    with client.app.state.sessions.begin() as db:
        db.get(Upload,identity).expires_at = time.time()-1
    assert client.post('/api/predictions',json={'upload_id':identity}).status_code == 410
    cleanup(settings)
    assert list((settings.data_dir/'uploads').iterdir()) == []


def test_catalog_and_health(client):
    species = client.get('/api/species').json()['items']
    assert len(species) == 6
    assert all(s['last_reviewed'] is None and s['sources'] for s in species)
    assert client.get('/api/species/missing').status_code == 404
    assert client.get('/api/health').status_code == 200
    assert client.get('/api/ready').json()['inference_available'] is False


def test_validation_no_sensitive_input_echo(client):
    response = client.post('/api/predictions',json={'upload_id':'invalid','top_k':99})
    assert response.status_code == 422
    assert response.json()['error']['code'] == 'validation_error'


def test_rate_limit(settings):
    from backend.main import create_app
    settings.rate_limit=1
    with TestClient(create_app(settings)) as client:
        assert client.get('/api/session').status_code == 200
        assert client.get('/api/session').status_code == 429


def test_production_fails_closed(settings):
    import pytest
    from backend.main import create_app
    settings.app_env='production'
    with pytest.raises(RuntimeError,match='Production requires'):
        with TestClient(create_app(settings)):
            pass


def test_dataset_license_gate_and_review(client):
    body={'source_url':'https://example.org/image','observation_url':'https://example.org/observation/1','object_key':'curated/image.jpg','scientific_name':'Scylla serrata','taxon_id':'review-pending','creator':'Contributor','license':'CC-BY-4.0','license_evidence_url':'https://example.org/license','provider':'expert','label_confidence':'high','sha256':'a'*64,'perceptual_hash':'b'*16,'observation_group':'obs1','training_rights':False,'redistribution_rights':False}
    headers={'X-Admin-Key':'test-reviewer-key'}
    assert client.post('/api/admin/dataset',headers=headers,json=body).status_code==422
    body['training_rights']=True
    response=client.post('/api/admin/dataset',headers=headers,json=body)
    assert response.status_code==201
    result=client.post(f"/api/admin/dataset/{response.json()['id']}/review",headers=headers,json={'decision':'accepted','note':'Source and permissions checked against signed agreement.'})
    assert result.json()['split']=='unassigned'
    body['object_key']='../outside.jpg'
    assert client.post('/api/admin/dataset',headers=headers,json=body).status_code==422
