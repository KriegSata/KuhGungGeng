"""Prepare and train a YOLOv8 detector from the frozen reviewed manifest.

Each manifest row must contain a normalized ``bbox_xywh`` for one crab.
The image files remain under ``root`` and YOLO label files are generated in
``output``. Run with training extras:

python -m ml.train_yolov8 split.jsonl dataset-root candidate-dir --epochs 10
"""
import argparse
import hashlib
import json
from pathlib import Path


def load_rows(manifest: Path, root: Path):
    rows = [json.loads(line) for line in manifest.read_text().splitlines() if line.strip()]
    if not rows:
        raise ValueError("Dataset is empty")
    labels = sorted({row["species_id"] for row in rows if row.get("split") == "train"})
    if len(labels) < 2:
        raise ValueError("Need at least two training classes")
    for row in rows:
        if row.get("verification_status") != "expert_reviewed" or not row.get("training_rights"):
            raise ValueError(f"Unreviewed or unlicensed record {row.get('image_id', '<unknown>')}")
        box = row.get("bbox_xywh")
        if not box or len(box) != 4 or any(not 0 < float(value) <= 1 for value in box[2:]) or any(not 0 <= float(value) <= 1 for value in box[:2]):
            raise ValueError(f"Expected normalized bbox_xywh for {row.get('image_id', '<unknown>')}")
        path = (root / row["object_key"]).resolve()
        if not path.is_relative_to(root.resolve()) or not path.is_file():
            raise ValueError(f"Image path is missing or escapes dataset root: {row['object_key']}")
        if hashlib.sha256(path.read_bytes()).hexdigest() != row["sha256"]:
            raise ValueError(f"Image checksum mismatch: {row['image_id']}")
    return rows, labels


def prepare_dataset(rows, labels, root: Path, output: Path):
    for split in ("train", "validation", "test"):
        (output / "images" / split).mkdir(parents=True, exist_ok=True)
        (output / "labels" / split).mkdir(parents=True, exist_ok=True)
    for row in rows:
        split = row["split"]
        if split == "calibration":
            continue
        image = (root / row["object_key"]).resolve()
        target = output / "images" / split / image.name
        target.write_bytes(image.read_bytes())
        x, y, width, height = (float(value) for value in row["bbox_xywh"])
        (output / "labels" / split / f"{image.stem}.txt").write_text(
            f"{labels.index(row['species_id'])} {x} {y} {width} {height}\n"
        )
    (output / "data.yaml").write_text(
        f"path: {output.as_posix()}\n"
        "train: images/train\n"
        "val: images/validation\n"
        "test: images/test\n"
        f"nc: {len(labels)}\n"
        f"names: {json.dumps(labels)}\n"
    )


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("root", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--model", default="yolov8n.pt")
    args = parser.parse_args()
    if args.epochs < 1:
        raise ValueError("At least one epoch is required")
    rows, labels = load_rows(args.manifest, args.root)
    prepare_dataset(rows, labels, args.root.resolve(), args.output.resolve())

    from ultralytics import YOLO
    model = YOLO(args.model)
    model.train(data=str(args.output / "data.yaml"), epochs=args.epochs, imgsz=640, seed=42)
    exported = model.export(format="onnx", imgsz=640, nms=False, dynamic=False)
    destination = args.output / "model.onnx"
    destination.write_bytes(Path(exported).read_bytes())
    version = hashlib.sha256(args.manifest.read_bytes()).hexdigest()[:12]
    (args.output / "training-report.json").write_text(json.dumps({
        "dataset_version": version,
        "task": "detection",
        "test_evaluated": False,
        "release_blockers": [
            "confidence and IoU thresholds not tuned",
            "held-out detection evaluation pending",
            "unknown/non-crab rejection pending",
            "expert sign-off pending",
        ],
    }, indent=2))
    (args.output / "manifest.json").write_text(json.dumps({
        "version": f"candidate-yolov8-{version}",
        "model_file": "model.onnx",
        "task": "detection",
        "sha256": hashlib.sha256(destination.read_bytes()).hexdigest(),
        "species_ids": labels,
        "input_size": 640,
        "mean": [0, 0, 0],
        "std": [1, 1, 1],
        "temperature": 1,
        "confidence_threshold": 0.5,
        "margin_threshold": 0,
        "energy_threshold": 0,
        "iou_threshold": 0.45,
        "max_detections": 20,
        "dataset_version": version,
        "evaluation_report": "training-report.json",
        "approved_for_release": False,
    }, indent=2))


if __name__ == "__main__":
    main()
