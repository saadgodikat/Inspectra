"""Train EfficientNet-B0 multiclass classifier for Inspectra.

Multiclass Defect Classification:
- 5 Classes: GOOD (0), CRACK (1), DENT (2), SCRATCH (3), OTHER_DEFECT (4).
- Uses manifest-driven training on ml/data/splits_multiclass/train.csv and val.csv.
- Pretrained EfficientNet-B0 with frozen backbone and 5-class linear classifier head.
- Loss: CrossEntropyLoss with softmax output.
- Optimizes on validation macro F1 and loss.
- Saves artifacts/multiclass_defect_model.pth and artifacts/multiclass_training_history.json.
- Strictly preserves artifacts/best_model.pth untouched.
"""

import os
import sys
import json
import time
import random
import argparse
from pathlib import Path
from typing import Dict, Any, List, Tuple
import numpy as np

# Ensure project root and ml/src are on sys.path
REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

ML_SRC = REPO_ROOT / "ml" / "src"
if ML_SRC.exists() and str(ML_SRC) not in sys.path:
    sys.path.insert(0, str(ML_SRC))

import torch
import torch.nn as nn
from torch.utils.data import DataLoader
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score

from inspectra_ml.dataset import (
    MulticlassManifestDataset,
    get_transforms,
    MULTICLASS_LABEL_TO_IDX,
    MULTICLASS_IDX_TO_LABEL,
)
from inspectra_ml.model import build_classifier


def set_seed(seed: int = 42) -> None:
    """Set random seed across all libraries for deterministic training."""
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)
    torch.backends.cudnn.deterministic = True
    torch.backends.cudnn.benchmark = False


def train_one_epoch(
    model: nn.Module,
    dataloader: DataLoader,
    criterion: nn.Module,
    optimizer: torch.optim.Optimizer,
    device: torch.device,
) -> float:
    """Run one training epoch and return average cross-entropy loss."""
    model.train()
    running_loss = 0.0
    total_samples = 0

    for images, labels, _ in dataloader:
        images = images.to(device)
        labels = labels.to(device, dtype=torch.long)

        optimizer.zero_grad()
        logits = model(images)
        loss = criterion(logits, labels)
        loss.backward()
        optimizer.step()

        batch_size = images.size(0)
        running_loss += loss.item() * batch_size
        total_samples += batch_size

    return running_loss / total_samples if total_samples > 0 else 0.0


@torch.no_grad()
def evaluate_model(
    model: nn.Module,
    dataloader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
) -> Tuple[float, np.ndarray, np.ndarray, np.ndarray]:
    """Evaluate model and return loss, true labels, predicted classes, and probabilities."""
    model.eval()
    running_loss = 0.0
    total_samples = 0
    all_true = []
    all_preds = []
    all_probs = []

    for images, labels, _ in dataloader:
        images = images.to(device)
        labels_dev = labels.to(device, dtype=torch.long)

        logits = model(images)
        loss = criterion(logits, labels_dev)

        probs = torch.softmax(logits, dim=1)
        preds = torch.argmax(probs, dim=1)

        batch_size = images.size(0)
        running_loss += loss.item() * batch_size
        total_samples += batch_size

        all_true.extend(labels.cpu().numpy())
        all_preds.extend(preds.cpu().numpy())
        all_probs.extend(probs.cpu().numpy())

    avg_loss = running_loss / total_samples if total_samples > 0 else 0.0
    return avg_loss, np.array(all_true), np.array(all_preds), np.array(all_probs)


def parse_args():
    parser = argparse.ArgumentParser(description="Train multiclass defect classifier")
    parser.add_argument("--epochs", type=int, default=5, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=16, help="Batch size for training")
    parser.add_argument("--lr", type=float, default=1e-3, help="Learning rate")
    parser.add_argument("--weight-decay", type=float, default=1e-4, help="Weight decay")
    parser.add_argument("--dropout", type=float, default=0.2, help="Classifier dropout rate")
    parser.add_argument("--seed", type=int, default=42, help="Random seed for reproducibility")
    parser.add_argument("--output-model", type=str, default="ml/artifacts/multiclass_defect_model.pth")
    parser.add_argument("--history-path", type=str, default="ml/artifacts/multiclass_training_history.json")
    parser.add_argument("--report-path", type=str, default="ml/reports/multiclass_training.md")
    return parser.parse_args()


def main():
    args = parse_args()
    set_seed(args.seed)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using device: {device}")

    train_manifest = REPO_ROOT / "ml" / "data" / "splits_multiclass" / "train.csv"
    val_manifest = REPO_ROOT / "ml" / "data" / "splits_multiclass" / "val.csv"

    if not train_manifest.exists() or not val_manifest.exists():
        raise FileNotFoundError(
            f"Split manifests not found. Run create_multiclass_splits.py first."
        )

    # Transforms
    train_transform = get_transforms(is_train=True, image_size=224)
    eval_transform = get_transforms(is_train=False, image_size=224)

    # Datasets
    train_dataset = MulticlassManifestDataset(
        manifest_path=train_manifest,
        repo_root=REPO_ROOT,
        transform=train_transform,
    )
    val_dataset = MulticlassManifestDataset(
        manifest_path=val_manifest,
        repo_root=REPO_ROOT,
        transform=eval_transform,
    )

    print(f"Training samples: {len(train_dataset)}, Validation samples: {len(val_dataset)}")

    train_loader = DataLoader(
        train_dataset,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=0,
        pin_memory=(device.type == "cuda"),
    )
    val_loader = DataLoader(
        val_dataset,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=0,
        pin_memory=(device.type == "cuda"),
    )

    # Build 5-class model
    model = build_classifier(
        pretrained=True,
        freeze_backbone=True,
        num_classes=5,
        dropout=args.dropout,
    ).to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.AdamW(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=args.lr,
        weight_decay=args.weight_decay,
    )
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=args.epochs)

    best_val_f1 = -1.0
    best_val_loss = float("inf")
    best_epoch = -1
    best_metrics = {}
    best_state_dict = None

    history = {
        "epochs": [],
        "train_loss": [],
        "val_loss": [],
        "val_accuracy": [],
        "val_macro_f1": [],
    }

    start_time = time.time()
    print("\n--- Starting Multiclass Training ---")

    for epoch in range(1, args.epochs + 1):
        t0 = time.time()
        train_loss = train_one_epoch(model, train_loader, criterion, optimizer, device)
        scheduler.step()

        val_loss, y_true, y_pred, _ = evaluate_model(model, val_loader, criterion, device)
        val_acc = accuracy_score(y_true, y_pred)
        val_f1 = f1_score(y_true, y_pred, average="macro", zero_division=0)
        epoch_sec = time.time() - t0

        history["epochs"].append(epoch)
        history["train_loss"].append(round(train_loss, 4))
        history["val_loss"].append(round(val_loss, 4))
        history["val_accuracy"].append(round(val_acc, 4))
        history["val_macro_f1"].append(round(val_f1, 4))

        print(
            f"Epoch [{epoch}/{args.epochs}] ({epoch_sec:.1f}s) - "
            f"Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f} | "
            f"Val Acc: {val_acc*100:.2f}% | Val Macro F1: {val_f1:.4f}"
        )

        # Select best model based on macro F1, tie-break on lower loss
        if (val_f1 > best_val_f1) or (val_f1 == best_val_f1 and val_loss < best_val_loss):
            best_val_f1 = val_f1
            best_val_loss = val_loss
            best_epoch = epoch
            best_metrics = {
                "val_accuracy": float(val_acc),
                "val_macro_f1": float(val_f1),
                "val_loss": float(val_loss),
            }
            best_state_dict = {k: v.cpu().clone() for k, v in model.state_dict().items()}

    total_training_sec = time.time() - start_time
    print(
        f"\nTraining completed in {total_training_sec:.1f}s. "
        f"Best Epoch: {best_epoch} with Val Macro F1: {best_val_f1:.4f}"
    )

    # Save best checkpoint
    out_model_path = REPO_ROOT / args.output_model
    out_model_path.parent.mkdir(parents=True, exist_ok=True)

    checkpoint = {
        "model_state_dict": best_state_dict,
        "config": {
            "model_architecture": "efficientnet_b0",
            "num_classes": 5,
            "classes": MULTICLASS_IDX_TO_LABEL,
            "label_to_idx": MULTICLASS_LABEL_TO_IDX,
            "image_size": 224,
            "epochs": args.epochs,
            "best_epoch": best_epoch,
            "seed": args.seed,
        },
        "metrics": best_metrics,
        "history": history,
    }
    torch.save(checkpoint, out_model_path)
    print(f"Saved best multiclass checkpoint to: {out_model_path}")

    # Save history json
    hist_path = REPO_ROOT / args.history_path
    with open(hist_path, "w", encoding="utf-8") as f:
        json.dump({
            "history": history,
            "best_epoch": best_epoch,
            "best_metrics": best_metrics,
            "total_time_seconds": round(total_training_sec, 2),
        }, f, indent=2)
    print(f"Saved training history to: {hist_path}")

    # Generate training report markdown
    report_path = REPO_ROOT / args.report_path
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_md = f"""# Inspectra Multiclass Defect Classifier — Training Report

**Model Architecture:** EfficientNet-B0 (pretrained ImageNet-1k, frozen backbone)  
**Task:** 5-Class Industrial Defect Classification  
**Classes:** {", ".join([f"{idx}: {name}" for idx, name in MULTICLASS_IDX_TO_LABEL.items()])}  
**Training Date:** {time.strftime('%Y-%m-%d %H:%M:%S')}  
**Checkpoint Path:** `{args.output_model}`  

---

## 1. Executive Training Summary

| Metric | Value |
| :--- | :--- |
| **Total Epochs** | {args.epochs} |
| **Best Epoch** | {best_epoch} |
| **Best Val Accuracy** | {best_metrics.get('val_accuracy', 0.0)*100:.2f}% |
| **Best Val Macro F1** | {best_metrics.get('val_macro_f1', 0.0):.4f} |
| **Best Val Loss** | {best_metrics.get('val_loss', 0.0):.4f} |
| **Training Duration** | {total_training_sec:.1f} seconds |
| **Device Used** | {device} |

---

## 2. Epoch-by-Epoch Progress

| Epoch | Train Loss | Val Loss | Val Accuracy | Val Macro F1 |
| :---: | :---: | :---: | :---: | :---: |
"""
    for ep, tl, vl, va, vf in zip(
        history["epochs"],
        history["train_loss"],
        history["val_loss"],
        history["val_accuracy"],
        history["val_macro_f1"],
    ):
        mark = " *(Best)*" if ep == best_epoch else ""
        report_md += f"| {ep}{mark} | {tl:.4f} | {vl:.4f} | {va*100:.2f}% | {vf:.4f} |\n"

    report_md += """
---

## 3. Disclosures & Boundaries

1. **Synthetic Data Disclosure:**  
   Defect images are sourced from the synthetic industrial metal surface dataset (`xanoutas/synthetic-industrial-defects-teaser`). Model metrics on synthetic textures do not guarantee identical performance on real manufacturing production lines without domain adaptation.

2. **Classification Scope:**  
   This model performs image-level multi-class classification, outputting softmax probabilities over the 5 defined classes. It does not perform defect bounding box localization or object detection.
"""

    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_md)
    print(f"Saved training report to: {report_path}")


if __name__ == "__main__":
    main()
