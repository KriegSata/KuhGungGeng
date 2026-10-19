"""Build deterministic leakage-resistant manifests from reviewed JSONL records.

python -m ml.split curated.jsonl split.jsonl --seed 42
All connected observation, author, exact-hash, and near-duplicate groups stay together.
This conservative MVP implementation is O(n^2); use a Hamming index at larger scale.
"""
import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path


def split_records(records: list[dict], seed: int = 42) -> list[dict]:
    if not records:
        raise ValueError('Dataset is empty')
    parents = list(range(len(records)))

    def root(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i

    def union(a, b):
        parents[root(b)] = root(a)

    seen = {}
    for i, row in enumerate(records):
        required = ['image_id','species_id','object_key','sha256','perceptual_hash','observation_group','creator','license','source_url']
        if any(not row.get(k) for k in required):
            raise ValueError(f'Missing provenance on record {i}')
        if row.get('verification_status') != 'expert_reviewed' or not row.get('training_rights'):
            raise ValueError(f'Unreviewed or unlicensed record {row["image_id"]}')
        if len(row['sha256']) != 64 or len(row['perceptual_hash']) != 16:
            raise ValueError('Expected SHA256 and 64-bit perceptual hash')
        for key in ['observation_group','sha256','creator']:
            value = (key, row[key])
            if value in seen:
                union(i, seen[value])
            seen[value] = i
        for j in range(i):
            if (int(row['perceptual_hash'],16) ^ int(records[j]['perceptual_hash'],16)).bit_count() <= 6:
                union(i,j)
    if len({r['image_id'] for r in records}) != len(records):
        raise ValueError('Image IDs must be unique')
    hash_labels = {}
    for row in records:
        if row['sha256'] in hash_labels and hash_labels[row['sha256']] != row['species_id']:
            raise ValueError('Exact duplicate has conflicting labels; resolve before splitting')
        hash_labels[row['sha256']] = row['species_id']
    groups = {}
    for i, row in enumerate(records):
        groups.setdefault(root(i), []).append(row)
    output=[]
    for group in groups.values():
        group_id=hashlib.sha256('|'.join(sorted(r['image_id'] for r in group)).encode()).hexdigest()
        bucket=int(hashlib.sha256(f'{seed}:{group_id}'.encode()).hexdigest()[:8],16)/0xffffffff
        split='train' if bucket<.60 else 'validation' if bucket<.75 else 'calibration' if bucket<.85 else 'test'
        for row in group:
            output.append({**row,'split':split,'leakage_group':group_id})
    return sorted(output,key=lambda r:r['image_id'])


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input',type=Path)
    parser.add_argument('output',type=Path)
    parser.add_argument('--seed',type=int,default=42)
    args=parser.parse_args()
    rows=split_records([json.loads(line) for line in args.input.read_text().splitlines() if line.strip()],args.seed)
    args.output.write_text('\n'.join(json.dumps(r) for r in rows)+'\n')
    print(json.dumps({'split_counts':dict(Counter(r['split'] for r in rows)), 'class_split_counts':dict(Counter(f"{r['species_id']}:{r['split']}" for r in rows))},indent=2))
    print('Freeze this manifest. Inspect class coverage and regional/source balance before training. Do not keep rerolling the seed to improve test results.')


if __name__=='__main__':
    main()
