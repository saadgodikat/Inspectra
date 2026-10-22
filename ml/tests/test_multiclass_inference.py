"""Tests for the Multiclass Inference service."""

import io
from pathlib import Path
import pytest
from PIL import Image
import torch
import torch.nn as nn

from inspectra_ml.multiclass_inference import (
    predict_multiclass_image,
    clear_multiclass_model_cache,
    DEFAULT_MULTICLASS_MODEL_NAME,
    DEFAULT_MULTICLASS_MODEL_VERSION,
)
from inspectra_ml.model import build_classifier
from inspectra_ml.dataset import MULTICLASS_LABEL_TO_IDX, MULTICLASS_IDX_TO_LABEL


@pytest.fixture
def dummy_image_bytes() -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", (100, 100), color=(128, 64, 32))
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def mock_multiclass_checkpoint(tmp_path: Path) -> Path:
    """Create a temporary valid multiclass checkpoint with random weights."""
    model = build_classifier(pretrained=False, freeze_backbone=True, num_classes=5)
    ckpt_path = tmp_path / "mock_multiclass.pth"
    torch.save({
        "model_state_dict": model.state_dict(),
        "config": {
            "num_classes": 5,
            "classes": MULTICLASS_IDX_TO_LABEL,
        },
    }, ckpt_path)
    return ckpt_path


def test_multiclass_predict_image_success(dummy_image_bytes, mock_multiclass_checkpoint):
    """Test successful multiclass prediction on image bytes with mock checkpoint."""
    clear_multiclass_model_cache()
    result = predict_multiclass_image(
        image=dummy_image_bytes,
        checkpoint_path=mock_multiclass_checkpoint,
    )

    assert result["status"] == "success"
    assert result["predicted_class"] in MULTICLASS_LABEL_TO_IDX
    assert "probabilities" in result
    probs = result["probabilities"]
    assert len(probs) == 5
    assert set(probs.keys()) == set(MULTICLASS_LABEL_TO_IDX.keys())
    assert abs(sum(probs.values()) - 1.0) < 1e-3
    assert 0.0 <= result["confidence"] <= 1.0
    assert result["model_name"] == DEFAULT_MULTICLASS_MODEL_NAME
    assert result["model_version"] == DEFAULT_MULTICLASS_MODEL_VERSION
    assert result["processing_duration_ms"] >= 0.0
    assert result["error_code"] is None
    assert result["error_details"] is None


def test_multiclass_predict_missing_checkpoint(dummy_image_bytes, tmp_path):
    """Test graceful handling when checkpoint does not exist."""
    clear_multiclass_model_cache()
    missing_ckpt = tmp_path / "does_not_exist.pth"
    result = predict_multiclass_image(
        image=dummy_image_bytes,
        checkpoint_path=missing_ckpt,
    )

    assert result["status"] == "failed"
    assert result["predicted_class"] is None
    assert result["probabilities"] is None
    assert result["confidence"] is None
    assert result["error_code"] == "CHECKPOINT_NOT_FOUND"
    assert "not found" in result["error_details"].lower()


def test_multiclass_predict_corrupt_image(mock_multiclass_checkpoint):
    """Test graceful handling when input image is corrupted."""
    clear_multiclass_model_cache()
    corrupt_bytes = b"CORRUPTED_BYTES_NOT_AN_IMAGE_12345"
    result = predict_multiclass_image(
        image=corrupt_bytes,
        checkpoint_path=mock_multiclass_checkpoint,
    )

    assert result["status"] == "failed"
    assert result["predicted_class"] is None
    assert result["probabilities"] is None
    assert result["error_code"] == "INVALID_IMAGE"


def test_multiclass_predict_empty_bytes(mock_multiclass_checkpoint):
    """Test graceful handling when input byte array is empty."""
    clear_multiclass_model_cache()
    result = predict_multiclass_image(
        image=b"",
        checkpoint_path=mock_multiclass_checkpoint,
    )

    assert result["status"] == "failed"
    assert result["predicted_class"] is None
    assert result["error_code"] == "INVALID_IMAGE"
