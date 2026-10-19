from types import SimpleNamespace
import numpy as np
import pytest
from PIL import Image
from backend.inference import Inference


def engine(logits):
    model=Inference('',set())
    model.manifest=SimpleNamespace(input_size=224,mean=(.485,.456,.406),std=(.229,.224,.225),temperature=1.,confidence_threshold=.8,margin_threshold=.15,energy_threshold=-2.,species_ids=['a','b'])
    model._logits=lambda tensor: np.array(logits,dtype=float)
    return model


@pytest.mark.parametrize('logits,quality,reason', [([6,0],[],None),([6,5.9],[],'ambiguous_species'),([0,0],[],'out_of_distribution'),([6,0],['underexposed'],'poor_image_quality')])
def test_abstention_policy(tmp_path,logits,quality,reason):
    photo=tmp_path/'a.jpg'
    Image.new('RGB',(640,480)).save(photo)
    result=engine(logits).predict(photo,quality,2)
    assert result['reason']==reason
    assert result['status']==('identified' if reason is None else 'insufficient_information')
    assert abs(sum(c['confidence'] for c in result['candidates'])-1)<.0001


def test_unapproved_model_rejected(tmp_path):
    import json
    from backend.schemas import ModelManifest
    bundle=tmp_path/'model.onnx'
    bundle.write_bytes(b'not a real model')
    manifest={'version':'test','model_file':'model.onnx','sha256':'a'*64,'species_ids':['a','b'],'input_size':224,'mean':[.485,.456,.406],'std':[.229,.224,.225],'temperature':1,'confidence_threshold':.9,'margin_threshold':.2,'energy_threshold':-2,'dataset_version':'test','evaluation_report':'report.json','approved_for_release':False}
    path=tmp_path/'manifest.json'
    path.write_text(json.dumps(manifest))
    with pytest.raises(ValueError,match='not been approved'):
        Inference(str(path),{'a','b'})


def test_loader_validates_checksum_labels_output_and_normalization(tmp_path,monkeypatch):
    import hashlib
    import json
    import sys
    bundle=tmp_path/'model.onnx';bundle.write_bytes(b'fixture')
    manifest={'version':'test','model_file':'model.onnx','sha256':hashlib.sha256(b'fixture').hexdigest(),'species_ids':['a','b'],'input_size':224,'mean':[.485,.456,.406],'std':[.229,.224,.225],'temperature':1,'confidence_threshold':.9,'margin_threshold':.2,'energy_threshold':-2,'dataset_version':'test','evaluation_report':'report.json','approved_for_release':True}
    path=tmp_path/'manifest.json'
    class Runtime:
        def __init__(self,*args,**kwargs): pass
        def get_inputs(self): return [SimpleNamespace(name='image')]
        def run(self,*args): return [np.array([[6.,0.]])]
    monkeypatch.setitem(sys.modules,'onnxruntime',SimpleNamespace(SessionOptions=lambda:SimpleNamespace(),InferenceSession=Runtime))
    path.write_text(json.dumps(manifest))
    loaded=Inference(str(path),{'a','b'})
    assert loaded.info()['available'] is True
    loaded.session.run=lambda *args:[np.array([[float('nan'),0.]])]
    with pytest.raises(ValueError,match='finite'): loaded._logits(np.zeros((1,3,224,224)))
    for change,match in [({'sha256':'b'*64},'checksum'),({'species_ids':['a','a']},'unique'),({'std':[0,1,1]},'positive'),({'model_file':'../escape.onnx'},'inside')]:
        path.write_text(json.dumps({**manifest,**change}))
        with pytest.raises(ValueError,match=match): Inference(str(path),{'a','b'})
