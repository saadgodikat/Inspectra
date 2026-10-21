"""Unit tests for Phase ML-4 held-out evaluation pipeline.

Does NOT require internet access, downloading pretrained weights, or running training.
"""

import csv
import pytest
from pathlib import Path
import torch

from inspectra_ml.model import build_classifier
from inspectra_ml.dataset import load_manifest
from inspectra_ml.metrics import compute_binary_metrics
from ml.scripts.evaluate import (
    verify_split_isolation,
    generate_heldout_markdown_report,
)


def test_checkpoint_loading_and_config(tmp_path: Path):
    """Verify saving and loading model checkpoint without downloading pretrained weights."""
    model = build_classifier(pretrained=False, freeze_backbone=True, num_classes=1)
    ckpt_path = tmp_path / "test_ckpt.pth"

    checkpoint = {
        "epoch": 3,
        "model_state_dict": model.state_dict(),
        "config": {
            "architecture": "efficientnet_b0",
            "num_classes": 1,
            "positive_class": "defective",
            "negative_class": "good",
        },
    }
    torch.save(checkpoint, ckpt_path)

    # Load and verify
    loaded = torch.load(ckpt_path, map_location="cpu", weights_only=False)
    assert loaded["epoch"] == 3
    assert loaded["config"]["architecture"] == "efficientnet_b0"

    new_model = build_classifier(pretrained=False, freeze_backbone=True, num_classes=1)
    new_model.load_state_dict(loaded["model_state_dict"])
    new_model.eval()

    dummy = torch.randn(2, 3, 224, 224)
    with torch.no_grad():
        out = new_model(dummy)
    assert out.shape == (2, 1)


def test_leakage_detection_raises_assertion(tmp_path: Path):
    """Verify that verify_split_isolation raises AssertionError when test hashes overlap with train/val."""
    train_csv = tmp_path / "train.csv"
    val_csv = tmp_path / "val.csv"
    test_csv = tmp_path / "test.csv"

    # Train contains hash_A
    with open(train_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["file_path", "label", "split", "sha256", "is_duplicate", "is_primary"])
        w.writerow(["train1.jpg", "good", "train", "hash_shared", "False", "True"])

    # Val contains hash_B
    with open(val_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["file_path", "label", "split", "sha256", "is_duplicate", "is_primary"])
        w.writerow(["val1.jpg", "defective", "val", "hash_B", "False", "True"])

    # Test also contains hash_shared (LEAK!)
    with open(test_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["file_path", "label", "split", "sha256", "is_duplicate", "is_primary"])
        w.writerow(["test1.jpg", "good", "test", "hash_shared", "False", "True"])

    with pytest.raises(AssertionError, match="CRITICAL TEST LEAKAGE DETECTED"):
        verify_split_isolation(train_csv, val_csv, test_csv, use_primary_only=True)


def test_leakage_detection_passes_when_disjoint(tmp_path: Path):
    """Verify that verify_split_isolation succeeds when splits share zero hashes."""
    train_csv = tmp_path / "train.csv"
    val_csv = tmp_path / "val.csv"
    test_csv = tmp_path / "test.csv"

    with open(train_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["file_path", "label", "split", "sha256", "is_duplicate", "is_primary"])
        w.writerow(["train1.jpg", "good", "train", "hash_train", "False", "True"])

    with open(val_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["file_path", "label", "split", "sha256", "is_duplicate", "is_primary"])
        w.writerow(["val1.jpg", "defective", "val", "hash_val", "False", "True"])

    with open(test_csv, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["file_path", "label", "split", "sha256", "is_duplicate", "is_primary"])
        w.writerow(["test1.jpg", "defective", "test", "hash_test", "False", "True"])

    # Should not raise
    verify_split_isolation(train_csv, val_csv, test_csv, use_primary_only=True)


def test_frozen_threshold_application():
    """Verify metric calculations with the frozen validation threshold of 0.38."""
    y_true = [0, 0, 1, 1]
    y_probs = [0.10, 0.35, 0.40, 0.90]

    # At threshold 0.38:
    # 0.10 < 0.38 -> 0 (TN)
    # 0.35 < 0.38 -> 0 (TN)
    # 0.40 >= 0.38 -> 1 (TP)
    # 0.90 >= 0.38 -> 1 (TP)
    # Perfectly separated at 0.38!
    m_38 = compute_binary_metrics(y_true, y_probs, threshold=0.38)
    assert m_38["accuracy"] == 1.0
    assert m_38["f1"] == 1.0
    assert m_38["confusion_matrix"] == {"tn": 2, "fp": 0, "fn": 0, "tp": 2}

    # At default threshold 0.50:
    # 0.40 < 0.50 -> 0 (FN)
    # FN = 1, TP = 1
    m_50 = compute_binary_metrics(y_true, y_probs, threshold=0.50)
    assert m_50["accuracy"] == 0.75
    assert m_50["confusion_matrix"]["fn"] == 1


def test_heldout_markdown_report_formatting(tmp_path: Path):
    """Verify Markdown report generation contains expected headers and comparison metrics."""
    test_metrics = {
        "accuracy": 0.965,
        "precision": 0.98,
        "recall": 0.95,
        "f1": 0.965,
        "roc_auc": 0.99,
        "confusion_matrix": {"tn": 440, "fp": 10, "fn": 15, "tp": 600},
    }
    val_metrics = {
        "accuracy": 0.97,
        "precision": 0.97,
        "recall": 0.97,
        "f1": 0.97,
        "roc_auc": 0.99,
    }

    report = generate_heldout_markdown_report(
        test_metrics_default=test_metrics,
        test_metrics_frozen=test_metrics,
        val_metrics=val_metrics,
        sample_count=1065,
        checkpoint_path=tmp_path / "best_model.pth",
        threshold=0.38,
        all_true=[0, 1],
        all_probs=[0.1, 0.9],
        all_paths=["good_1.jpg", "def_1.jpg"],
    )

    assert "# Held-Out Test Evaluation Report — Phase ML-4" in report
    assert "Executive Summary & Generalization Performance" in report
    assert "Frozen Operating Threshold" in report
    assert "Confusion Matrix (Held-Out Test Set)" in report
    assert "Architectural Readiness for Phase ML-5" in report
