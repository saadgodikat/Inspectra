"""Tests for multiclass split manifests and data leakage prevention."""

import os
import csv
from pathlib import Path
import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
SPLITS_DIR = REPO_ROOT / "ml" / "data" / "splits_multiclass"

EXPECTED_CLASSES = {"GOOD", "CRACK", "DENT", "SCRATCH", "OTHER_DEFECT"}


def test_splits_files_exist():
    """Verify train, val, and test manifest CSV files exist."""
    assert (SPLITS_DIR / "train.csv").exists()
    assert (SPLITS_DIR / "val.csv").exists()
    assert (SPLITS_DIR / "test.csv").exists()
    assert (SPLITS_DIR / "manifest.csv").exists()


def test_no_data_leakage_between_splits():
    """Verify strict SHA-256 hash isolation across splits."""
    def get_hashes(manifest_name):
        hashes = set()
        with open(SPLITS_DIR / manifest_name, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                hashes.add(row["sha256"])
        return hashes

    train_hashes = get_hashes("train.csv")
    val_hashes = get_hashes("val.csv")
    test_hashes = get_hashes("test.csv")

    assert len(train_hashes & val_hashes) == 0, "Train and Val share image hashes!"
    assert len(train_hashes & test_hashes) == 0, "Train and Test share image hashes!"
    assert len(val_hashes & test_hashes) == 0, "Val and Test share image hashes!"


def test_all_five_classes_present_in_each_split():
    """Verify all 5 classes are represented in train, val, and test splits."""
    for split_file in ["train.csv", "val.csv", "test.csv"]:
        classes_found = set()
        with open(SPLITS_DIR / split_file, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                classes_found.add(row["label"])
        assert classes_found == EXPECTED_CLASSES, f"Missing classes in {split_file}: {EXPECTED_CLASSES - classes_found}"


@pytest.mark.skipif(not (REPO_ROOT / "ml" / "data" / "external" / "synthetic_industrial_defects").exists(), reason="External synthetic dataset images not present locally")
def test_image_files_exist_on_disk():
    """Verify that all file paths in the manifests exist on disk."""
    with open(SPLITS_DIR / "test.csv", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            p = REPO_ROOT / row["file_path"]
            assert p.exists(), f"File in manifest not found on disk: {p}"
