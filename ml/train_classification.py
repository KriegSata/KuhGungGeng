"""Prepare folder-labelled experimental data and train YOLOv8 classification.

python -m ml.train_classification Crabs data/crabs-classification --prepare-only
python -m ml.train_classification Crabs data/crabs-classification --epochs 30
Folder labels are provisional; no review or licensing metadata is asserted.
"""
import argparse
from collections import Counter, defaultdict
import hashlib
import json
import os
from pathlib import Path
import random
import re

from PIL import Image, ImageOps


def prepare(root: Path, output: Path, seed=42):
    root, output = root.resolve(), output.resolve()
    if output.exists():
        raise ValueError(f'Destination already exists; use --reuse-data: {output}')
    rows, skipped = [], []
    exact = defaultdict(list)
    for path in sorted(root.rglob('*')):
        if not path.is_file() or path.suffix.lower() not in {'.png', '.jpg', '.jpeg', '.webp', '.bmp'}:
            continue
        relative = path.relative_to(root)
        if len(relative.parts) < 2:
            continue
        folder = relative.parts[0]
        species = re.search(r'\(([^)]+)', folder)
        label = re.sub(r'[^a-z0-9]+', '-', (species.group(1) if species else folder).lower()).strip('-')
        try:
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            with Image.open(path) as image:
                image = ImageOps.exif_transpose(image).convert('RGB')
                image.load()
                if min(image.size) < 32:
                    raise ValueError('Image smaller than 32 pixels')
                small = ImageOps.fit(image.convert('L'), (9, 8))
                pixels = list(small.getdata())
                phash = 0
                for y in range(8):
                    for x in range(8):
                        phash = (phash << 1) | (pixels[y * 9 + x] < pixels[y * 9 + x + 1])
            row = dict(source=relative.as_posix(), label=label, sha256=digest, phash=phash)
            exact[digest].append(row)
            if sum(map(len, exact.values())) % 500 == 0:
                print(f'Checked {sum(map(len, exact.values()))} images', flush=True)
        except (OSError, ValueError, Image.DecompressionBombError) as error:
            skipped.append(dict(source=relative.as_posix(), reason=str(error)))
    duplicates = 0
    for copies in exact.values():
        if len({row['label'] for row in copies}) > 1:
            skipped.extend(dict(source=row['source'], reason='Exact duplicate has conflicting folder labels') for row in copies)
            continue
        rows.append(copies[0])
        duplicates += len(copies) - 1
    # Connected near duplicates stay together, including across class folders.
    parents = list(range(len(rows)))
    def find(i):
        while parents[i] != i:
            parents[i] = parents[parents[i]]
            i = parents[i]
        return i
    for i, row in enumerate(rows):
        if i % 1000 == 0:
            print(f'Grouping near duplicates: {i}/{len(rows)}', flush=True)
        for j in range(i):
            if (row['phash'] ^ rows[j]['phash']).bit_count() <= 4:
                parents[find(i)] = find(j)
    groups = defaultdict(list)
    for i, row in enumerate(rows):
        groups[find(i)].append(row)
    grouped = list(groups.values())
    random.Random(seed).shuffle(grouped)
    grouped.sort(key=len, reverse=True)
    labels = sorted({row['label'] for row in rows})
    if len(labels) < 2:
        raise ValueError('Need at least two nonempty species folders')
    totals = Counter(row['label'] for row in rows)
    counts = {split: Counter() for split in ('train', 'val', 'test')}
    ratios = dict(train=.7, val=.15, test=.15)
    for group in grouped:
        composition = Counter(row['label'] for row in group)
        split = max(ratios, key=lambda s: sum(n * (totals[c] * ratios[s] - counts[s][c]) / max(1, totals[c] * ratios[s]) for c, n in composition.items()))
        counts[split].update(composition)
        group_id = hashlib.sha256(''.join(sorted(row['sha256'] for row in group)).encode()).hexdigest()
        for row in group:
            row.update(split=split, leakage_group=group_id)
    if any(counts[s][label] == 0 for s in counts for label in labels):
        raise ValueError('Near-duplicate grouping leaves a class absent from a split; inspect dataset before training')
    output.mkdir(parents=True)
    for row in rows:
        destination = output / row['split'] / row['label'] / (row['sha256'] + '.jpg')
        destination.parent.mkdir(parents=True, exist_ok=True)
        with Image.open(root / row['source']) as image:
            image = ImageOps.exif_transpose(image).convert('RGB')
            image.thumbnail((1600, 1600))
            image.save(destination, quality=95)
    report = dict(source=str(root), seed=seed, classes=labels, images=len(rows),
                  exact_duplicates_removed=duplicates, near_duplicate_groups=len(groups),
                  counts={s: dict(c) for s, c in counts.items()}, skipped=skipped,
                  labels_verified=False, approved_for_release=False,
                  limitations=['Folder labels are provisional', 'Provenance and rights not verified',
                               'Unknown observation/photographer groups may still leak across splits'])
    (output / 'preparation-report.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    (output / 'split.jsonl').write_text(''.join(json.dumps(row) + '\n' for row in rows), encoding='utf-8')
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('root', type=Path)
    parser.add_argument('data', type=Path)
    parser.add_argument('--prepare-only', action='store_true')
    parser.add_argument('--reuse-data', action='store_true')
    parser.add_argument('--epochs', type=int, default=30)
    parser.add_argument('--batch', type=int, default=32)
    parser.add_argument('--device', default='0')
    parser.add_argument('--model', default='yolov8n-cls.pt')
    args = parser.parse_args()
    if args.epochs < 1 or args.batch < 1:
        parser.error('epochs and batch must be positive')
    if not args.reuse_data:
        report = prepare(args.root, args.data)
    else:
        report = json.loads((args.data / 'preparation-report.json').read_text(encoding='utf-8'))
    print(json.dumps(report, indent=2), flush=True)
    if args.prepare_only:
        return
    os.environ.setdefault('YOLO_CONFIG_DIR', str(Path('.cache').resolve()))
    from ultralytics import YOLO
    model = YOLO(args.model)
    if model.task != 'classify':
        raise ValueError('Select a classification model such as yolov8n-cls.pt')
    model.train(data=str(args.data.resolve()), epochs=args.epochs, imgsz=224,
                batch=args.batch, device=args.device, workers=0, seed=42,
                patience=10, project=str(Path('runs/classify').resolve()),
                name='crabs-yolov8n', plots=True)
    run = Path(model.trainer.save_dir)
    (run / 'candidate-report.json').write_text(json.dumps(dict(
        task='classification', approved_for_release=False, test_evaluated=False,
        d