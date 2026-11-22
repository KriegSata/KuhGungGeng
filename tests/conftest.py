import io
import pytest
from fastapi.testclient import TestClient
from PIL import Image
from backend.config import Settings
from backend.main import create_app


@pytest.fixture
def settings(tmp_path):
    return Settings(data_dir=tmp_path, database_url=f"sqlite:///{tmp_path / 'test.db'}", admin_api_key="test-reviewer-key", rate_limit=1000, use_bundled_classifier=False, _env_file=None)


@pytest.fixture
def client(settings):
    with TestClient(create_app(settings)) as client:
        session = client.get('/api/session').json()
        client.headers['X-CSRF-Token'] = session['csrf_token']
        yield client


@pytest.fixture
def photo():
    stream = io.BytesIO()
    image = Image.new('RGB', (640, 480), '#658365')
    exif = Image.Exif()
    exif[270] = 'Private metadata'
    image.save(stream, 'JPEG', exif=exif)
    return stream.getvalue()
