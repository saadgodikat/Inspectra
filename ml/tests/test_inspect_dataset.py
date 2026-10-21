"""Automated tests for Inspectra dataset inspection & audit tool."""

import pytest
import hashlib
from pathlib import Path
from PIL import Image

from ml.scripts.inspect_dataset import (
    audit_dataset,
    compute_file_sha256,
    infer_label,
    generate_markdown_report,
    DEFAULT_LABEL_MAPPING,
    DEFAULT_SUPPORTED_EXTENSIONS,
)


@pytest.fixture
def synthetic_dataset(tmp_path: Path) -> Path:
    """Create a temporary synthetic dataset with valid, duplicate, corrupt, and invalid files."""
    dataset_dir = tmp_path / "mock_casting_data"
    dataset_dir.mkdir(parents=True, exist_ok=True)

    ok_dir = dataset_dir / "ok_front"
    def_dir = dataset_dir / "def_front"
    ok_dir.mkdir()
    def_dir.mkdir()

    # 1. Valid 'good' images
    img1 = Image.new("RGB", (32, 32), color=(200, 200, 200))
    img1.save(ok_dir / "cast_ok_1.png", format="PNG")

    img2 = Image.new("RGB", (32, 32), color=(220, 220, 220))
    img2.save(ok_dir / "cast_ok_2.png", format="PNG")

    # 2. Valid 'defective' image
    img_def1 = Image.new("RGB", (64, 64), color=(50, 50, 50))
    img_def1.save(def_dir / "cast_def_1.png", format="PNG")

    # 3. Exact duplicate of def_1 (identical bytes)
    with open(def_dir / "cast_def_1.png", "rb") as f_src:
        content = f_src.read()
    with open(def_dir / "cast_def_dup.png", "wb") as f_dst:
        f_dst.write(content)

    # 4. Corrupt image file (invalid header/bytes)
    with open(def_dir / "corrupted.png", "wb") as f_corrupt:
        f_corrupt.write(b"CORRUPT_PNG_HEADER_DATA_NOT_VALID_IMAGE")

    # 5. Unsupported file format (.txt)
    with open(def_dir / "metadata.txt", "w", encoding="utf-8") as f_txt:
        f_txt.write("Batch info: Line 4")

    # 6. Zero-byte empty image
    with open(def_dir / "empty.png", "wb") as f_empty:
        pass

    return dataset_dir


def test_sha256_computation(tmp_path: Path):
    """Verify SHA-256 computation matches known content hash."""
    test_file = tmp_path / "test.txt"
    test_file.write_bytes(b"hello inspectra")

    expected_hash = hashlib.sha256(b"hello inspectra").hexdigest()
    assert compute_file_sha256(test_file) == expected_hash


def test_label_inference():
    """Verify class label inference from directory structure and fallback filenames."""
    root = Path("/datasets/casting")

    path_ok = root / "ok_front" / "img_01.png"
    assert infer_label(path_ok, root, DEFAULT_LABEL_MAPPING) == "good"

    path_def = root / "def_front" / "img_02.png"
    assert infer_label(path_def, root, DEFAULT_LABEL_MAPPING) == "defective"

    path_nested = root / "train" / "def_front" / "img_03.png"
    assert infer_label(path_nested, root, DEFAULT_LABEL_MAPPING) == "defective"

    path_unknown = root / "unclassified" / "random.png"
    assert infer_label(path_unknown, root, DEFAULT_LABEL_MAPPING) is None


def test_synthetic_dataset_audit(synthetic_dataset: Path):
    """Verify that audit_dataset scans, categorizes, detects duplicates, and catches corrupt images."""
    result = audit_dataset(
        data_dir=synthetic_dataset,
        label_mapping=DEFAULT_LABEL_MAPPING,
        supported_extensions=DEFAULT_SUPPORTED_EXTENSIONS,
    )

    # 7 files were created in total
    assert result["total_files_scanned"] == 7
    # 4 valid images (2 good, 2 defective including duplicate)
    assert result["valid_images"] == 4
    assert result["class_counts"]["good"] == 2
    assert result["class_counts"]["defective"] == 2
    assert result["imbalance_ratio"] == 1.0

    # Dimension checks
    assert result["min_dimensions"] == (32, 32)
    assert result["max_dimensions"] == (64, 64)

    # Format verification
    assert result["format_counts"]["PNG"] == 4

    # Exact duplicate detection
    assert result["total_duplicate_files"] == 1
    assert len(result["exact_duplicate_groups"]) == 1

    # Exclusions verification (unsupported .txt, corrupt .png, empty .png)
    assert result["exclusions_count"] == 3
    categories = {exc["category"] for exc in result["exclusions"]}
    assert "unsupported_extension" in categories
    assert "corrupted_image" in categories
    assert "empty_file" in categories


def test_missing_dataset_directory(tmp_path: Path):
    """Verify that audit_dataset raises FileNotFoundError on missing directory."""
    non_existent = tmp_path / "does_not_exist"
    with pytest.raises(FileNotFoundError, match="Dataset directory not found"):
        audit_dataset(non_existent)


def test_supported_image_formats_and_unlabelled(tmp_path: Path):
    """Verify multiple supported formats (JPEG, PNG) and unlabelled sample handling."""
    data_dir = tmp_path / "formats_test"
    good_dir = data_dir / "good"
    unknown_dir = data_dir / "unknown_folder"
    good_dir.mkdir(parents=True)
    unknown_dir.mkdir(parents=True)

    # Valid PNG
    img_png = Image.new("RGB", (40, 40), color="blue")
    img_png.save(good_dir / "item_1.png", format="PNG")

    # Valid JPEG
    img_jpg = Image.new("RGB", (50, 50), color="red")
    img_jpg.save(good_dir / "item_2.jpg", format="JPEG")

    # Valid PNG in unmapped folder (unlabelled)
    img_unlabelled = Image.new("RGB", (60, 60), color="green")
    img_unlabelled.save(unknown_dir / "sample.png", format="PNG")

    result = audit_dataset(data_dir)
    assert result["valid_images"] == 2
    assert result["format_counts"]["PNG"] == 1
    assert result["format_counts"]["JPEG"] == 1
    assert result["class_counts"]["good"] == 2
    assert result["exclusions_count"] == 1
    assert result["exclusions"][0]["category"] == "unlabelled_sample"


def test_class_count_and_imbalance_ratio(tmp_path: Path):
    """Verify class count reporting and imbalance ratio calculation."""
    data_dir = tmp_path / "imbalance_test"
    ok_dir = data_dir / "ok_front"
    def_dir = data_dir / "def_front"
    ok_dir.mkdir(parents=True)
    def_dir.mkdir(parents=True)

    for i in range(3):
        img = Image.new("RGB", (32, 32), color=(i * 10, i * 10, i * 10))
        img.save(ok_dir / f"cast_ok_{i}.png", format="PNG")

    img_def = Image.new("RGB", (32, 32), color=(255, 0, 0))
    img_def.save(def_dir / "cast_def_0.png", format="PNG")

    result = audit_dataset(data_dir)
    assert result["valid_images"] == 4
    assert result["class_counts"]["good"] == 3
    assert result["class_counts"]["defective"] == 1
    assert result["class_percentages"]["good"] == 75.0
    assert result["class_percentages"]["defective"] == 25.0
    assert result["imbalance_ratio"] == 3.0


def test_empty_dataset_audit(tmp_path: Path):
    """Verify graceful handling when dataset directory is empty."""
    empty_dir = tmp_path / "empty_dataset"
    empty_dir.mkdir()

    result = audit_dataset(empty_dir)
    assert result["total_files_scanned"] == 0
    assert result["valid_images"] == 0
    assert result["exclusions_count"] == 0


def test_duplicates_within_single_split(tmp_path: Path):
    """Verify detection and reporting of exact duplicates contained entirely within a single split."""
    data_dir = tmp_path / "within_split_test"
    train_ok = data_dir / "train" / "ok_front"
    train_ok.mkdir(parents=True)

    img = Image.new("RGB", (32, 32), color=(100, 100, 100))
    img.save(train_ok / "img1.png", format="PNG")

    # Byte copy in the same split
    img_bytes = (train_ok / "img1.png").read_bytes()
    (train_ok / "img1_dup.png").write_bytes(img_bytes)

    result = audit_dataset(data_dir)
    assert result["total_duplicate_files"] == 1
    assert result["cross_split_duplicate_groups"] == 0
    assert result["within_split_duplicate_groups"] == 1
    assert len(result["duplicate_groups_details"]) == 1
    assert result["duplicate_groups_details"][0]["crosses_splits"] is False
    assert result["duplicate_groups_details"][0]["splits"] == ["train"]


def test_duplicates_across_train_test_splits(tmp_path: Path):
    """Verify detection and reporting of exact duplicates spanning across train and test splits (leakage)."""
    data_dir = tmp_path / "cross_split_test"
    train_ok = data_dir / "train" / "ok_front"
    test_ok = data_dir / "test" / "ok_front"
    train_ok.mkdir(parents=True)
    test_ok.mkdir(parents=True)

    img = Image.new("RGB", (32, 32), color=(150, 150, 150))
    img.save(train_ok / "shared_item.png", format="PNG")

    # Identical byte copy in test split
    img_bytes = (train_ok / "shared_item.png").read_bytes()
    (test_ok / "shared_item_in_test.png").write_bytes(img_bytes)

    result = audit_dataset(data_dir)
    assert result["total_duplicate_files"] == 1
    assert result["cross_split_duplicate_groups"] == 1
    assert result["within_split_duplicate_groups"] == 0
    assert len(result["duplicate_groups_details"]) == 1
    assert result["duplicate_groups_details"][0]["crosses_splits"] is True
    assert set(result["duplicate_groups_details"][0]["splits"]) == {"test", "train"}


def test_markdown_report_formatting(synthetic_dataset: Path):
    """Verify Markdown report generator output."""
    result = audit_dataset(synthetic_dataset)
    report_md = generate_markdown_report(result)

    assert "# Dataset Audit Report — Phase ML-1" in report_md
    assert "Total Files Scanned" in report_md
    assert "Exact Duplicate Files" in report_md
    assert "corrupted_image" in report_md
    assert "good" in report_md
    assert "defective" in report_md
    assert "Detected Image Formats" in report_md
    assert "Duplicate Groups Crossing Splits" in report_md
    assert "Duplicate Groups Within Same Split" in report_md
