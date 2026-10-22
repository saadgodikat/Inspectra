"""Tests for the 5-class EfficientNet-B0 multiclass model architecture."""

import torch
import torch.nn as nn
import pytest

from inspectra_ml.model import build_classifier
from inspectra_ml.dataset import MULTICLASS_LABEL_TO_IDX, MULTICLASS_IDX_TO_LABEL


def test_build_multiclass_classifier_architecture():
    """Verify 5-class model output dimension and backbone freezing."""
    model = build_classifier(
        pretrained=False,
        freeze_backbone=True,
        num_classes=5,
        dropout=0.2,
    )
    assert isinstance(model, nn.Module)

    # Check that backbone features are frozen
    for param in model.features.parameters():
        assert param.requires_grad is False

    # Check that classifier head requires grad
    for param in model.classifier.parameters():
        assert param.requires_grad is True

    # Check forward pass shape
    dummy_input = torch.randn(2, 3, 224, 224)
    output = model(dummy_input)
    assert output.shape == (2, 5), f"Expected shape (2, 5), got {output.shape}"


def test_multiclass_label_mapping_consistency():
    """Verify bidirectional 5-class label mapping integrity."""
    assert len(MULTICLASS_LABEL_TO_IDX) == 5
    assert len(MULTICLASS_IDX_TO_LABEL) == 5

    for label, idx in MULTICLASS_LABEL_TO_IDX.items():
        assert MULTICLASS_IDX_TO_LABEL[idx] == label

    expected_labels = {"GOOD", "CRACK", "DENT", "SCRATCH", "OTHER_DEFECT"}
    assert set(MULTICLASS_LABEL_TO_IDX.keys()) == expected_labels
    assert set(MULTICLASS_IDX_TO_LABEL.keys()) == {0, 1, 2, 3, 4}
