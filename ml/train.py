"""Offline EfficientNet baseline. Produces a candidate, never a release-approved model.

Install training extras, then: python -m ml.train split.jsonl dataset-root candidate-dir
Uses only train/validation/calibration splits. The test split stays sealed.
"""
import argparse
import copy
import hashlib
import json
import random
from pathlib import Path

import numpy as np
import torch
from PIL import Image, ImageOps
from torch.utils.data import Dataset, DataLoader
from torchvision.models import EfficientNet_B0_Weights, efficientnet_b0


class Photos(Dataset):
    def __init__(self, rows, root, labels, augment=False):
        self.rows,self.root,self.labels,self.augment=rows,root.resolve(),labels,augment

    def __len__(self):
        return len(self.rows)

    def __getitem__(self,index):
        row=self.rows[index]
        path=(self.root/row['object_key']).resolve()
        if not path.is_relative_to(self.root):
            raise ValueError('Image path escapes dataset root')
        if hashlib.sha256(path.read_bytes()).hexdigest()!=row['sha256']:
            raise ValueError(f'Image checksum mismatch: {row["image_id"]}')
        with Image.open(path) as image:
            image=ImageOps.pad(ImageOps.exif_transpose(image).convert('RGB'),(224,224),color=(127,127,127))
            if self.augment and random.random()<.5:
                image=ImageOps.mirror(image)
            tensor=np.asarray(image,dtype=np.float32)/255
        tensor=((tensor-np.array([.485,.456,.406],dtype=np.float32))/np.array([.229,.224,.225],dtype=np.float32)).transpose(2,0,1)
        return torch.from_numpy(tensor.copy()),self.labels.index(row['species_id'])


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('manifest',type=Path)
    parser.add_argument('root',type=Path)
    parser.add_argument('output',type=Path)
    parser.add_argument('--epochs',type=int,default=10)
    parser.add_argument('--seed',type=int,default=42)
    args=parser.parse_args()
    random.seed(args.seed);np.random.seed(args.seed);torch.manual_seed(args.seed)
    if args.epochs<1: raise ValueError('At least one epoch is required')
    rows=[json.loads(line) for line in args.manifest.read_text().splitlines() if line.strip()]
    if any(r.get('verification_status')!='expert_reviewed' or not r.get('training_rights') for r in rows):
        raise ValueError('Every training manifest item must be reviewed and licensed')
    groups={}
    for row in rows:
        group=row['leakage_group']
        if group in groups and groups[group]!=row['split']: raise ValueError('Leakage group spans splits')
        groups[group]=row['split']
    labels=sorted({r['species_id'] for r in rows if r['split']=='train'})
    if len(labels)<2: raise ValueError('Need at least two classes')
    loaders={}
    for split in ['train','validation','calibration']:
        subset=[r for r in rows if r['split']==split]
        if set(r['species_id'] for r in subset)!=set(labels): raise ValueError(f'Class coverage missing in {split}')
        loaders[split]=DataLoader(Photos(subset,args.root,labels,split=='train'),batch_size=16,shuffle=split=='train',num_workers=0)
    device=torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    model=efficientnet_b0(weights=EfficientNet_B0_Weights.DEFAULT)
    model.classifier[1]=torch.nn.Linear(model.classifier[1].in_features,len(labels))
    model.to(device)
    counts=np.array([sum(r['species_id']==label and r['split']=='train' for r in rows) for label in labels])
    weights=torch.tensor(1/np.sqrt(counts),dtype=torch.float32,device=device)
    weights/=weights.mean()
    criterion=torch.nn.CrossEntropyLoss(weight=weights)
    optimizer=torch.optim.AdamW(model.parameters(),lr=1e-4,weight_decay=.01)
    best_loss=float('inf');best=None;history=[]
    for epoch in range(args.epochs):
        model.train()
        for images,targets in loaders['train']:
            optimizer.zero_grad();loss=criterion(model(images.to(device)),targets.to(device));loss.backward();optimizer.step()
        model.eval();total=0.;count=0
        with torch.no_grad():
            for images,targets in loaders['validation']:
                total+=torch.nn.functional.cross_entropy(model(images.to(device)),targets.to(device),reduction='sum').item();count+=len(targets)
        score=total/count;history.append({'epoch':epoch+1,'validation_nll':score});print(history[-1])
        if score<best_loss: best_loss=score;best=copy.deepcopy(model.state_dict())
    model.load_state_dict(best);model.eval()
    logits=[];targets=[]
    with torch.no_grad():
        for images,target in loaders['calibration']:
            logits.append(model(images.to(device)).cpu());targets.append(target)
    logits=torch.cat(logits);targets=torch.cat(targets)
    log_temperature=torch.nn.Parameter(torch.zeros(1))
    optimizer=torch.optim.LBFGS([log_temperature],lr=.05,max_iter=50)
    def closure():
        optimizer.zero_grad();loss=torch.nn.functional.cross_entropy(logits/log_temperature.exp().clamp(.05,20),targets);loss.backward();return loss
    optimizer.step(closure)
    temperature=float(log_temperature.detach().exp().clamp(.05,20).item())
    args.output.mkdir(parents=True,exist_ok=True)
    model.cpu()
    torch.save(model.state_dict(),args.output/'weights.pt')
    torch.onnx.export(model,torch.zeros(1,3,224,224),str(args.output/'model.onnx'),input_names=['image'],output_names=['logits'],opset_version=17,dynamo=False)
    version=hashlib.sha256(args.manifest.read_bytes()).hexdigest()[:12]
    report={'dataset_version':version,'history':history,'temperature':temperature,'seed':args.seed,'test_evaluated':False,'release_blockers':['OOD thresholds not tuned','held-out evaluation pending','regional/life-stage audit pending','expert sign-off pending']}
    (args.output/'training-report.json').write_text(json.dumps(report,indent=2))
    # Conservative placeholders must be replaced after threshold selection and held-out evaluation.
    manifest={'version':f'candidate-{version}','model_file':'model.onnx','sha256':hashlib.sha256((args.output/'model.onnx').read_bytes()).hexdigest(),'species_ids':labels,'input_size':224,'mean':[.485,.456,.406],'std':[.229,.224,.225],'temperature':temperature,'confidence_threshold':1.,'margin_threshold':1.,'energy_threshold':-1e9,'dataset_version':version,'evaluation_report':'training-report.json','approved_for_release':False}
    (args.output/'manifest.json').write_text(json.dumps(manifest,indent=2))
    print('Candidate exported. Threshold tuning, held-out evaluation, and expert approval are required before serving.')


if __name__=='__main__':
    main()
