"""EfficientNet-B0 binary defect classification model for Inspectra."""

import torch
import torch.nn as nn
from torchvision.models import efficientnet_b0, EfficientNet_B0_Weights


def build_classifier(
    pretrained: bool = True,
    freeze_backbone: bool = True,
    num_classes: int = 1,
    dropout: float = 0.2,
) -> nn.Module:
    """Build an EfficientNet-B0 classifier tailored for binary defect inspection.

    Args:
        pretrained: If True, initializes backbone with ImageNet-1k weights.
        freeze_backbone: If True, freezes feature extractor parameters for fast linear-probing.
        num_classes: Output logits dimension (1 for binary BCEWithLogitsLoss).
        dropout: Classifier head dropout probability.

    Returns:
        Configured PyTorch nn.Module.
    """
    weights = EfficientNet_B0_Weights.DEFAULT if pretrained else None
    model = efficientnet_b0(weights=weights)

    if freeze_backbone:
        for param in model.features.parameters():
            param.requires_grad = False

    # Replace original 1000-class classifier with custom inspection head
    in_features = model.classifier[1].in_features
    model.classifier = nn.Sequential(
        nn.Dropout(p=dropout, inplace=True),
        nn.Linear(in_features=in_features, out_features=num_classes),
    )

    return model
