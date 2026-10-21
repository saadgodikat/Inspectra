"""Automated tests for leakage-safe dataset splitting (Phase ML-2)."""

import csv
import json
import pytest
from pathlib import Path
from PIL import Image

from ml.scripts.create_splits import (
    scan_and_group_by_hash,
    partition_hashes_stratified,
    build_manifest_records,
    verify_no_leakage,
    calculate_split_statistics,
    export_manifests,
)


@pytest.fixture
def sample_dataset(tmp_path: Path) -> Path:
    """Create a synthetic dataset with good/defective images and duplicate pairs."""
    data_dir = tmp_path / "mock_casting"
    ok_dir = data_dir / "ok_front"
    def_dir = data_dir / "def_front"
    ok_dir.mkdir(parents=True)
    def_dir.mkdir(parents=True)

    # 10 unique good images
    for i in range(10):
        img = Image.new("RGB", (32, 32), color=(i * 10, i * 10, i * 10))
        img.save(ok_dir / f"good_{i}.png", format="PNG")

    # 10 unique defective images
    for i in range(10):
        img = Image.new("RGB", (32, 32), color=(200, i * 10, 0))
        img.save(def_dir / f"def_{i}.png", format="PNG")

    # 2 duplicate images: copy of good_0 and copy of def_0
    good_0_bytes = (ok_dir / "good_0.png").read_bytes()
    (ok_dir / "good_0_copy.png").write_bytes(good_0_bytes)

    def_0_bytes = (def_dir / "def_0.png").read_bytes()
    (def_dir / "def_0_copy.png").write_bytes(def_0_bytes)

    # Total: 22 files, 20 unique hashes, 2 duplicate groups
    return data_dir


def test_deterministic_assignment(sample_dataset: Path):
    """Verify that using the same random seed produces identical split assignments."""
    hash_to_group, _ = scan_and_group_by_hash(sample_dataset)

    split_1 = partition_hashes_stratified(hash_to_group, seed=42)
    split_2 = partition_hashes_stratified(hash_to_group, seed=42)
    assert split_1 == split_2

    # Different seed should produce a different assignment
    split_diff = partition_hashes_stratified(hash_to_group, seed=999)
    # Check that at least some assignments differ
    differences = sum(1 for h in split_1 if split_1[h] != split_diff[h])
    assert differences > 0


def test_duplicate_group_isolation(sample_dataset: Path):
    """Verify that duplicate images sharing an identical hash are always in the same split."""
    hash_to_group, _ = scan_and_group_by_hash(sample_dataset)
    hash_to_split = partition_hashes_stratified(hash_to_group, seed=42)
    records = build_manifest_records(hash_to_group, hash_to_split)

    # verify_no_leakage raises AssertionError if any hash crosses splits
    verify_no_leakage(records)

    # Check specifically the duplicate groups
    dup_records = [r for r in records if r["is_duplicate"]]
    assert len(dup_records) == 4  # 2 files for good_0, 2 files for def_0

    # Group duplicate records by hash
    hash_to_splits = {}
    for r in dup_records:
        hash_to_splits.setdefault(r["sha256"], set()).add(r["split"])

    for h, splits in hash_to_splits.items():
        assert len(splits) == 1, f"Hash {h} leaked across multiple splits: {splits}"


def test_class_preservation_and_stratification(sample_dataset: Path):
    """Verify class proportions are preserved across train, val, and test splits."""
    hash_to_group, _ = scan_and_group_by_hash(sample_dataset)
    hash_to_split = partition_hashes_stratified(
        hash_to_group,
        train_ratio=0.70,
        val_ratio=0.15,
        test_ratio=0.15,
        seed=42,
    )
    records = build_manifest_records(hash_to_group, hash_to_split)
    stats = calculate_split_statistics(
        records, hash_to_group, 0.70, 0.15, 0.15, seed=42
    )

    # 10 good hashes, 10 defective hashes (50/50 balance)
    for sp in ["train", "val", "test"]:
        sp_stats = stats["splits"][sp]
        good_count = sp_stats["class_hash_counts"].get("good", 0)
        def_count = sp_stats["class_hash_counts"].get("defective", 0)
        # In a 10/10 split with 70/15/15: train=7, val=2, test=1 or train=7, val=1, test=2
        assert good_count > 0
        assert def_count > 0
        # Stratification maintains equal counts per class
        assert good_count == def_count


def test_missing_dataset_directory(tmp_path: Path):
    """Verify FileNotFoundError when dataset directory does not exist."""
    non_existent = tmp_path / "does_not_exist"
    with pytest.raises(FileNotFoundError, match="Dataset directory not found"):
        scan_and_group_by_hash(non_existent)


def test_empty_dataset_handling(tmp_path: Path):
    """Verify ValueError when dataset directory contains no valid images."""
    empty_dir = tmp_path / "empty_dir"
    empty_dir.mkdir()
    with pytest.raises(ValueError, match="No valid images found"):
        scan_and_group_by_hash(empty_dir)


def test_invalid_ratios_handling(sample_dataset: Path):
    """Verify ValueError when split ratios do not sum to 1.0."""
    hash_to_group, _ = scan_and_group_by_hash(sample_dataset)
    with pytest.raises(ValueError, match="Split ratios must sum to 1.0"):
        partition_hashes_stratified(
            hash_to_group,
            train_ratio=0.80,
            val_ratio=0.20,
            test_ratio=0.20,  # sums to 1.20
        )


def test_manifest_files_creation(sample_dataset: Path, tmp_path: Path):
    """Verify CSV and JSON manifest files are exported properly with expected headers."""
    output_dir = tmp_path / "splits_output"
    hash_to_group, _ = scan_and_group_by_hash(sample_dataset)
    hash_to_split = partition_hashes_stratified(hash_to_group, seed=42)
    records = build_manifest_records(hash_to_group, hash_to_split)
    stats = calculate_split_statistics(records, hash_to_group, 0.70, 0.15, 0.15, seed=42)

    export_manifests(records, stats, output_dir)

    # Check files exist
    assert (output_dir / "manifest.csv").exists()
    assert (output_dir / "train.csv").exists()
    assert (output_dir / "val.csv").exists()
    assert (output_dir / "test.csv").exists()
    assert (output_dir / "manifest.json").exists()

    # Verify CSV content and header
    with open(output_dir / "manifest.csv", "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        assert len(rows) == 22
        assert "file_path" in reader.fieldnames
        assert "label" in reader.fieldnames
        assert "split" in reader.fieldnames
        assert "sha256" in reader.fieldnames
        assert "is_duplicate" in reader.fieldnames

    # Verify JSON content
    with open(output_dir / "manifest.json", "r", encoding="utf-8") as f:
        meta = json.load(f)
        assert meta["total_files"] == 22
        assert meta["total_unique_hashes"] == 20
        assert meta["total_duplicate_groups"] == 2
        assert "train" in meta["splits"]
        assert "val" in meta["splits"]
        assert "test" in meta["splits"]
