"""Unit tests for Phase ML-3 baseline model, dataset loading, and metrics.

Does NOT require internet access or downloading pretrained weights.
"""

import csv
import pytest
from pathlib import Path
from PIL import Image
import torch
import numpy as np

from inspectra_ml.dataset import (
    load_manifest,
    get_transforms,
    LABEL_TO_IDX,
    IDX_TO_LABEL,
)
from inspectra_ml.model import build_classifier
from inspectra_ml.metrics import compute_binary_metrics, find_optimal_threshold
from ml.scripts.train import set_seed


def test_label_mapping():
    """Verify canonical binary label encodings."""
    assert LABEL_TO_IDX["good"] == 0
    assert LABEL_TO_IDX["defective"] == 1
    assert IDX_TO_LABEL[0] == "good"
    assert IDX_TO_LABEL[1] == "defective"


def test_manifest_loading_and_primary_filter(tmp_path: Path):
    """Verify loading manifest CSV and filtering by is_primary flag."""
    manifest_file = tmp_path / "test_manifest.csv"
    with open(manifest_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["file_path", "label", "split", "sha256", "is_duplicate", "is_primary"])
        writer.writerow(["img1.jpg", "good", "train", "hash1", "False", "True"])
        writer.writerow(["img2.jpg", "defective", "train", "hash2", "True", "True"])
        writer.writerow(["img2_dup.jpg", "defective", "train", "hash2", "True", "False"])

    # Test with primary only
    records_primary = load_manifest(manifest_file, use_primary_only=True)
    assert len(records_primary) == 2
    assert {r["file_path"] for r in records_primary} == {"img1.jpg", "img2.jpg"}

    # Test with all records
    records_all = load_manifest(manifest_file, use_primary_only=False)
    assert len(records_all) == 3


def test_preprocessing_pipeline():
    """Verify transform pipeline produces expected tensor shape and normalization."""
    raw_img = Image.new("RGB", (300, 300), color=(128, 128, 128))

    transform_val = get_transforms(is_train=False, image_size=224)
    tensor_val = transform_val(raw_img)
    assert isinstance(tensor_val, torch.Tensor)
    assert tensor_val.shape == (3, 224, 224)
    assert tensor_val.dtype == torch.float32

    transform_train = get_transforms(is_train=True, image_size=224)
    tensor_train = transform_train(raw_img)
    assert tensor_train.shape == (3, 224, 224)


def test_model_architecture_without_pretrained():
    """Verify model construction, frozen feature extractor, and forward pass without downloading weights."""
    model = build_classifier(pretrained=False, freeze_backbone=True, num_classes=1)

    # Check parameter freezing
    for param in model.features.parameters():
        assert not param.requires_grad

    # Check classifier head requires grad
    for param in model.classifier.parameters():
        assert param.requires_grad

    # Check forward pass shape with dummy input
    dummy_input = torch.randn(2, 3, 224, 224)
    logits = model(dummy_input)
    assert logits.shape == (2, 1)


def test_reproducibility_settings():
    """Verify set_seed ensures deterministic random tensor generation."""
    set_seed(42)
    t1 = torch.rand(10)
    a1 = np.random.rand(10)

    set_seed(42)
    t2 = torch.rand(10)
    a2 = np.random.rand(10)

    assert torch.allclose(t1, t2)
    assert np.allclose(a1, a2)


def test_metrics_calculation_perfect_prediction():
    """Verify metric calculations for 100% accurate predictions."""
    y_true = [0, 0, 1, 1]
    y_probs = [0.05, 0.10, 0.85, 0.95]

    metrics = compute_binary_metrics(y_true, y_probs, threshold=0.5)
    assert metrics["accuracy"] == 1.0
    assert metrics["precision"] == 1.0
    assert metrics["recall"] == 1.0
    assert metrics["f1"] == 1.0
    assert metrics["roc_auc"] == 1.0
    assert metrics["confusion_matrix"] == {"tn": 2, "fp": 0, "fn": 0, "tp": 2}


def test_metrics_calculation_imperfect_prediction():
    """Verify confusion matrix and metrics with false positives and false negatives."""
    y_true = [0, 0, 1, 1]
    # Prediction: 0 (TN), 1 (FP), 0 (FN), 1 (TP)
    y_probs = [0.1, 0.8, 0.2, 0.9]

    metrics = compute_binary_metrics(y_true, y_probs, threshold=0.5)
    assert metrics["accuracy"] == 0.5
    assert metrics["precision"] == 0.5  # 1 TP / (1 TP + 1 FP)
    assert metrics["recall"] == 0.5     # 1 TP / (1 TP + 1 FN)
    assert metrics["f1"] == 0.5
    assert metrics["confusion_matrix"] == {"tn": 1, "fp": 1, "fn": 1, "tp": 1}


def test_optimal_threshold_search():
    """Verify that find_optimal_threshold selects the threshold yielding highest F1."""
    y_true = [0, 0, 0, 1, 1]
    # Defect probabilities are lower (e.g. around 0.35 - 0.40)
    y_probs = [0.05, 0.10, 0.15, 0.35, 0.40]

    # At 0.50 threshold, F1 is 0.0 because predicted are all 0
    m_default = compute_binary_metrics(y_true, y_probs, threshold=0.50)
    assert m_default["f1"] == 0.0

    # Optimal threshold search should find a threshold around 0.25 - 0.30 with F1 == 1.0
    best_thresh, best_metrics = find_optimal_threshold(y_true, y_probs, metric="f1")
    assert best_thresh < 0.35
    assert best_metrics["f1"] == 1.0
