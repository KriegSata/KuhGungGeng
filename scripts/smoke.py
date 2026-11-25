"""Run an HTTP smoke test through Vite's proxy, cleaning up only owned processes."""
import io
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import time

import httpx
from PIL import Image


def main():
    for port in [8000,5173]:
        with socket.socket() as check:
            check.bind(('127.0.0.1',port))
    processes=[]
    flags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0
    Path('data').mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(dir='data',prefix='smoke-') as directory:
        root=Path(directory).resolve()
        env={**os.environ,'APP_ENV':'development','DATA_DIR':str(root),'DATABASE_URL':f'sqlite:///{root / "smoke.db"}','MODEL_MANIFEST':'','EXPERIMENTAL_CLASSIFIER':'','USE_BUNDLED_CLASSIFIER':'false','CLAMAV_HOST':''}
        try:
            with (root/'api.log').open('w') as api_log, (root/'web.log').open('w') as web_log:
                processes.append(subprocess.Popen([sys.executable,'-m','uvicorn','backend.main:app','--host','127.0.0.1','--port','8000'],env=env,stdout=api_log,stderr=subprocess.STDOUT,creationflags=flags))
                processes.append(subprocess.Popen([shutil.which('node'),'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort'],env=env,stdout=web_log,stderr=subprocess.STDOUT,creationflags=flags))
                with httpx.Client(base_url='http://127.0.0.1:5173',timeout=10) as client:
                    for attempt in range(60):
                        try:
                            if client.get('/api/ready').status_code==200: break
                        except httpx.HTTPError: pass
                        if any(p.poll() is not None for p in processes): raise RuntimeError('A smoke server exited early')
                        time.sleep(.5)
                    else: raise RuntimeError('Smoke servers did not become ready')
                    response=client.get('/')
                    assert response.status_code==200 and 'Shellfie' in response.text
                    client.headers['X-CSRF-Token']=client.get('/api/session').json()['csrf_token']
                    assert len(client.get('/api/species').json()['items'])==6
                    stream=io.BytesIO();Image.new('RGB',(640,480),'green').save(stream,'JPEG')
                    uploaded=client.post('/api/uploads',files={'file':('crab.jpg',stream.getvalue(),'image/jpeg')})
                    assert uploaded.status_code==201,uploaded.text
                    response=client.post('/api/predictions',json={'upload_id':uploaded.json()['id']})
                    assert response.status_code==201,response.text
                    prediction=response.json()
                    assert prediction['reason']=='model_unavailable' and prediction['candidates']==[]
                    assert len(client.get('/api/predictions').json()['items'])==1
                    assert client.delete(f"/api/predictions/{prediction['id']}").status_code==204
                    print('HTTP smoke passed: frontend -> proxy -> session -> catalog -> upload -> abstention -> history -> deletion.')
        finally:
            for process in processes:
                process.terminate()
            for process in processes:
                try: process.wait(timeout=10)
                except subprocess.TimeoutExpired: process.kill();process.wait()


if __name__=='__main__':
    main()
