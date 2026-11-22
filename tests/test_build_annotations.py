import hashlib
from PIL import Image

from ml.build_annotations import build_annotations


def test_build_annotations_maps_known_folder(tmp_path):
    root = tmp_path / "Crabs"
    folder = root / "Giant Mud Crab (Scylla serrata)"
    folder.mkdir(parents=True)
    image = folder / "crab.jpg"
    Image.new("RGB", (100, 80), "red").save(image)

    output = tmp_path / "annotations.jsonl"
    report = build_annotations(root, output, {
        "Giant Mud Crab (Scylla serrata)": "scylla-serrata",
    })

    lines = output.read_text().splitlines()
    assert len(lines) == 1
    record = __import__("json").loads(lines[0])
    assert record["species_id"] == "scylla-serrata"
    assert record["object_key"] == "Giant Mud Crab (Scylla serrata)/crab.jpg"
    assert record["sha256"] == hashlib.sha256(image.read_bytes()).hexdigest()
    assert record["perceptual_hash"]
    assert record["bbox_xywh"] is None
    assert record["verification_status"] == "unreviewed"
    assert report["mapped_species_count"] == 1


def test_build_annotations_maps_three_spot_swimming_crab(tmp_path):
    root = tmp_path / "Crabs"
    folder = root / "Three-Spot Swimming Crab (Portunus sanguinolentus)"
    folder.mkdir(parents=True)
    image = folder / "crab.jpg"
    Image.new("RGB", (100, 80), "blue").save(image)

    output = tmp_path / "annotations.jsonl"
    build_annotations(root, output, {
        "Three-Spot Swimming Crab (Portunus sanguinolentus)": "portunus-sanguinolentus",
    })

    record = __import__("json").loads(output.read_text().splitlines()[0])
    assert record["species_id"] == "portunus-sanguinolentus"
    assert record["training_rights"] is True
    assert record["redistribution_rights"] is True


def test_build_annotations_derives_species_id_from_parentheses(tmp_path):
    root = tmp_path / "Crabs"
    folder = root / "Asian Shore Crab (Hemigrapsus sanguineus)"
    folder.mkdir(parents=True)
    Image.new("RGB", (100, 80), "blue").save(folder / "crab.jpg")

    output = tmp_path / "annotations.jsonl"
    build_annotations(root, output, {})

    record = __import__("json").loads(output.read_text().splitlines()[0])
    assert record["species_id"] == "hemigrapsus-sanguineus"
    assert record["scientific_name"] == "Hemigrapsus sanguineus"
