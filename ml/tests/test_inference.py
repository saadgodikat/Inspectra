"""Unit tests for Phase ML-5 inference module.

Uses lightweight synthetic checkpoints and does NOT require downloading pretrained weights.
"""

import io
import pytest
from pathlib import Path
from PIL import Image
import torch

from inspectra_ml.model import build_classifier
from inspectra_ml.inference import (
    predict_image,
    load_model,
    clear_model_cache,
    DEFAULT_THRESHOLD,
)


@pytest.fixture(autouse=True)
def reset_cache():
    """Ensure clean cache before and after each test."""
    clear_model_cache()
    yield
    clear_model_cache()


@pytest.fixture
def synthetic_checkpoint(tmp_path: Path) -> Path:
    """Create a lightweight synthetic checkpoint without external downloads."""
    model = build_classifier(pretrained=False, freeze_backbone=True, num_classes=1)
    ckpt_path = tmp_path / "synthetic_model.pth"

    checkpoint = {
        "epoch": 1,
        "model_state_dict": model.state_dict(),
        "config": {
            "architecture": "efficientnet_b0",
            "num_classes": 1,
            "positive_class": "defective",
            "negative_class": "good",
        },
    }
    torch.save(checkpoint, ckpt_path)
    return ckpt_path


@pytest.fixture
def sample_pil_image() -> Image.Image:
    """Create a small 100x100 RGB image."""
    return Image.new("RGB", (100, 100), color=(180, 180, 180))


@pytest.fixture
def sample_image_bytes(sample_pil_image: Image.Image) -> bytes:
    """Return raw JPEG bytes of sample image."""
    buf = io.BytesIO()
    sample_pil_image.save(buf, format="JPEG")
    return buf.getvalue()


@pytest.fixture
def sample_image_file(tmp_path: Path, sample_pil_image: Image.Image) -> Path:
    """Save sample image to file on disk."""
    img_path = tmp_path / "test_casting.jpg"
    sample_pil_image.save(img_path, format="JPEG")
    return img_path


def test_predict_from_file_path(synthetic_checkpoint: Path, sample_image_file: Path):
    """Verify inference from a valid image filesystem path."""
    res = predict_image(sample_image_file, checkpoint_path=synthetic_checkpoint)

    assert res["status"] == "success"
    assert res["predicted_class"] in {"good", "defective"}
    assert res["score_type"] == "sigmoid_score"
    assert "good" in res["scores"]
    assert "defective" in res["scores"]
    assert round(res["scores"]["good"] + res["scores"]["defective"], 2) == 1.00
    assert res["threshold"] == DEFAULT_THRESHOLD
    assert res["error_code"] is None
    assert res["error_details"] is None
    assert res["processing_duration_ms"] >= 0


def test_predict_from_raw_bytes(synthetic_checkpoint: Path, sample_image_bytes: bytes):
    """Verify inference from raw in-memory image bytes."""
    res = predict_image(sample_image_bytes, checkpoint_path=synthetic_checkpoint)

    assert res["status"] == "success"
    assert res["predicted_class"] in {"good", "defective"}
    assert res["score_type"] == "sigmoid_score"
    assert res["error_code"] is None


def test_predict_from_bytesio_stream(synthetic_checkpoint: Path, sample_image_bytes: bytes):
    """Verify inference from an io.BytesIO stream."""
    stream = io.BytesIO(sample_image_bytes)
    res = predict_image(stream, checkpoint_path=synthetic_checkpoint)

    assert res["status"] == "success"
    assert res["predicted_class"] in {"good", "defective"}


def test_model_caching(synthetic_checkpoint: Path, sample_image_bytes: bytes):
    """Verify that model loading is cached across repeated invocations."""
    clear_model_cache()

    # First load
    m1, dev1 = load_model(synthetic_checkpoint)
    res1 = predict_image(sample_image_bytes, checkpoint_path=synthetic_checkpoint)

    # Second load should return identical model object
    m2, dev2 = load_model(synthetic_checkpoint)
    res2 = predict_image(sample_image_bytes, checkpoint_path=synthetic_checkpoint)

    assert m1 is m2
    assert res1["status"] == "success"
    assert res2["status"] == "success"


def test_threshold_decision_logic(synthetic_checkpoint: Path, sample_image_bytes: bytes):
    """Verify decision boundary honors configurable threshold."""
    # With extreme threshold 0.0, any score >= 0.0 must be classified as 'defective'
    res_def = predict_image(sample_image_bytes, checkpoint_path=synthetic_checkpoint, threshold=0.0)
    assert res_def["predicted_class"] == "defective"
    assert res_def["threshold"] == 0.0

    # With extreme threshold 1.0, probability < 1.0 must be classified as 'good'
    res_good = predict_image(sample_image_bytes, checkpoint_path=synthetic_checkpoint, threshold=1.0)
    assert res_good["predicted_class"] == "good"
    assert res_good["threshold"] == 1.0


def test_missing_checkpoint_handling(sample_image_bytes: bytes, tmp_path: Path):
    """Verify graceful handling when checkpoint does not exist."""
    missing_path = tmp_path / "non_existent_weights.pth"
    res = predict_image(sample_image_bytes, checkpoint_path=missing_path)

    assert res["status"] == "failed"
    assert res["predicted_class"] is None
    assert res["scores"] is None
    assert res["error_code"] == "CHECKPOINT_NOT_FOUND"
    assert "not found" in res["error_details"].lower()
    # Ensure sensitive paths are not leaked in error details
    assert str(tmp_path) not in res["error_details"]


def test_incompatible_checkpoint_handling(sample_image_bytes: bytes, tmp_path: Path):
    """Verify graceful handling of corrupted or incompatible checkpoint."""
    corrupt_ckpt = tmp_path / "corrupt.pth"
    with open(corrupt_ckpt, "wb") as f:
        f.write(b"CORRUPT_NOT_A_TORCH_STATE_DICT")

    res = predict_image(sample_image_bytes, checkpoint_path=corrupt_ckpt)
    assert res["status"] == "failed"
    assert res["error_code"] == "INCOMPATIBLE_CHECKPOINT"
    assert str(tmp_path) not in res["error_details"]


def test_invalid_image_bytes_handling(synthetic_checkpoint: Path):
    """Verify graceful failure when passed corrupt image bytes."""
    corrupt_bytes = b"NOT_A_VALID_IMAGE_DATA_BYTES_HEADER"
    res = predict_image(corrupt_bytes, checkpoint_path=synthetic_checkpoint)

    assert res["status"] == "failed"
    assert res["predicted_class"] is None
    assert res["scores"] is None
    assert res["error_code"] == "INVALID_IMAGE"
    assert "could not be decoded" in res["error_details"]


def test_empty_image_bytes_handling(synthetic_checkpoint: Path):
    """Verify graceful failure on empty byte string."""
    res = predict_image(b"", checkpoint_path=synthetic_checkpoint)

    assert res["status"] == "failed"
    assert res["predicted_class"] is None
    assert res["error_code"] == "INVALID_IMAGE"


def test_non_existent_image_file(synthetic_checkpoint: Path, tmp_path: Path):
    """Verify graceful failure when image path does not exist."""
    fake_path = tmp_path / "missing_photo.jpg"
    res = predict_image(fake_path, checkpoint_path=synthetic_checkpoint)

    assert res["status"] == "failed"
    assert res["error_code"] == "INVALID_IMAGE"
    assert str(tmp_path) not in res["error_details"]


def test_return_schema_completeness(synthetic_checkpoint: Path, sample_image_bytes: bytes):
    """Verify all 10 required schema fields are present in response."""
    res = predict_image(sample_image_bytes, checkpoint_path=synthetic_checkpoint)

    required_keys = [
        "status",
        "predicted_class",
        "scores",
        "score_type",
        "model_name",
        "model_version",
        "processing_duration_ms",
        "threshold",
        "error_code",
        "error_details",
    ]
    for key in required_keys:
        assert key in res, f"Missing required key: {key}"

    assert res["score_type"] == "sigmoid_score"
