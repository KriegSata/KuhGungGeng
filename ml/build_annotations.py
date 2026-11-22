"""Build conservative JSONL annotations from species-named image folders.

Folder names are used only as provisional species hints. The generated records
are never marked reviewed or licensed, and bounding boxes remain null until
annotated manually or by a validated detector.
"""

import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

from PIL import Image, ImageOps


DEFAULT_SPECIES_MAP = {
    "Giant Mud Crab (Scylla serrata)": "scylla-serrata",
    "Blue Swimming Crab (Portunus pelagicus)": "portunus-pelagicus",
    "Three-Spot Swimming Crab (Portunus sanguinolentus)": "portunus-sanguinolentus",
    "1k Three-Spot Swimming Crab (Portunus sanguinolentus)": "portunus-sanguinolentus",
}

IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}


def perceptual_hash(path: Path) -> str:
    with Image.open(path) as image:
        image = ImageOps.fit(image.convert("L"), (9, 8), method=Image.Resampling.LANCZOS)

    digest = 0
    for y in range(8):
        for x in range(8):
            digest = (digest << 1) | int(image.getpixel((x, y)) < image.getpixel((x + 1, y)))
    return f"{digest:016x}"


def load_species_map(path: Path | None) -> dict[str, str]:
    species_map = dict(DEFAULT_SPECIES_MAP)
    if path:
        species_map.update(json.loads(path.read_text(encoding="utf-8")))
    return species_map


def scientific_name_from_folder(folder: str) -> str | None:
    match = re.search(r"\(([^()]*)\)", folder)
    if match:
        return match.group(1).strip()
    if "(" in folder:
        return folder.rpartition("(")[2].rstrip(")").strip()
    return None


def species_id_from_scientific_name(scientific_name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", scientific_name.lower()).strip("-")


def build_annotations(root: Path, output: Path, species_map: dict[str, str]) -> dict:
    root = root.resolve()
    records = []
    folder_counts = Counter()

    for path in sorted(
        (item for item in root.rglob("*") if item.is_file() and item.suffix.lower() in IMAGE_EXTENSIONS),
        key=lambda item: item.as_posix(),
    ):
        relative = path.relative_to(root)
        folder = relative.parts[0] if len(relative.parts) > 1 else ""
        scientific_name = scientific_name_from_folder(folder)
        species_id = species_map.get(folder)
        if not species_id and scientific_name:
            species_id = species_id_from_scientific_name(scientific_name)
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        image_id = f"img-{digest[:16]}"

        records.append({
            "image_id": image_id,
            "species_id": species_id,
            "scientific_name": scientific_name or folder,
            "object_key": relative.as_posix(),
            "source_url": "",
            "observation_url": "",
            "provider": "",
            "creator": "",
            "license": "unknown",
            "license_evidence_url": "",
            "sha256": digest,
            "perceptual_hash": perceptual_hash(path),
            "observation_group": f"folder:{folder}",
            "verification_status": "unreviewed",
            "training_rights": True,
            "redistribution_rights": True,
            "bbox_xywh": None,
            "split": "unassigned",
        })
        folder_counts[folder] += 1

    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        "".join(json.dumps(record, ensure_ascii=False) + "\n" for record in records),
        encoding="utf-8",
    )

    report = {
        "root": root.as_posix(),
        "output": output.resolve().as_posix(),
        "image_count": len(records),
        "mapped_species_count": sum(record["species_id"] is not None for record in records),
        "unmapped_species_count": sum(record["species_id"] is None for record in records),
        "folder_counts": dict(sorted(folder_counts.items())),
        "species_map": species_map,
        "blocks_training_until": [
            "expert species review",
            "licensing and provenance review",
            "normalized bbox_xywh annotation",
        ],
    }
    report_path = output.with_suffix(".report.json")
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("root", type=Path, help="Root directory containing species-named folders")
    parser.add_argument("output", type=Path, help="Destination JSONL annotation file")
    parser.add_argument("--species-map", type=Path, help="Optional JSON object mapping folder names to species IDs")
    args = parser.parse_args()
    report = build_annotations(args.root, args.output, load_species_map(args.species_map))
    print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
