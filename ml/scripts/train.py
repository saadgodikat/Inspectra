"""Train EfficientNet-B0 baseline classifier for Inspectra.

Phase ML-3: Baseline Defect Classifier
- Uses manifest-driven training on train.csv and validation on val.csv.
- Uses pretrained EfficientNet-B0 with frozen backbone for fast, reproducible convergence.
- Positive class: 'defective' (label 1), negative class: 'good' (label 0).
- Model selection and threshold tuning performed strictly on the validation set.
- Generates artifacts/best_model.pth, training_history.json, and reports/baseline_training.md.
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

from inspectra_ml.dataset import (
    CastingManifestDataset,
    get_transforms,
    LABEL_TO_IDX,
    IDX_TO_LABEL,
)
from inspectra_ml.model import build_classifier
from inspectra_ml.metrics import compute_binary_metrics, find_optimal_threshold


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
    """Run one training epoch and return average loss."""
    model.train()
    running_loss = 0.0
    total_samples = 0

    for images, labels, _ in dataloader:
        images = images.to(device)
        labels = labels.to(device, dtype=torch.float32).unsqueeze(1)

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
) -> Tuple[float, List[int], List[float]]:
    """Evaluate model and return loss, true labels, and predicted positive probabilities."""
    model.eval()
    running_loss = 0.0
    total_samples = 0
    all_true = []
    all_probs = []

    for images, labels, _ in dataloader:
        images = images.to(device)
        labels_t = labels.to(device, dtype=torch.float32).unsqueeze(1)

        logits = model(images)
        loss = criterion(logits, labels_t)

        probs = torch.sigmoid(logits).squeeze(1).cpu().numpy().tolist()

        batch_size = images.size(0)
        running_loss += loss.item() * batch_size
        total_samples += batch_size

        all_true.extend(labels.numpy().tolist())
        all_probs.extend(probs)

    avg_loss = running_loss / total_samples if total_samples > 0 else 0.0
    return avg_loss, all_true, all_probs


def generate_training_report(
    history: Dict[str, Any],
    best_val_metrics: Dict[str, Any],
    optimal_val_metrics: Dict[str, Any],
    optimal_threshold: float,
    train_count: int,
    val_count: int,
    args: argparse.Namespace,
) -> str:
    """Format training results as a GitHub-flavored Markdown report."""
    cm = best_val_metrics["confusion_matrix"]
    opt_cm = optimal_val_metrics["confusion_matrix"]

    lines = [
        "# Baseline Defect Classifier Training Report — Phase ML-3",
        "",
        f"**Model Architecture:** `EfficientNet-B0` (Pretrained on ImageNet-1k, Linear Probing Head)  ",
        f"**Target Task:** Binary Defect Classification (`good` vs `defective`)  ",
        f"**Positive Class:** `defective` (Label 1)  ",
        f"**Negative Class:** `good` (Label 0)  ",
        f"**Training Set Size:** {train_count} unique primary images  ",
        f"**Validation Set Size:** {val_count} unique primary images  ",
        f"**Random Seed:** `{args.seed}`  ",
        f"**Epochs:** {args.epochs} | **Batch Size:** {args.batch_size} | **LR:** {args.lr}  ",
        "",
        "---",
        "",
        "## 1. Executive Summary",
        "",
        "| Metric | Validation (Default Threshold = 0.50) | Validation (Optimized Threshold = " + f"{optimal_threshold:.2f}" + ") |",
        "| :--- | :--- | :--- |",
        f"| **Accuracy** | {best_val_metrics['accuracy'] * 100:.2f}% | {optimal_val_metrics['accuracy'] * 100:.2f}% |",
        f"| **Precision (Defective)** | {best_val_metrics['precision'] * 100:.2f}% | {optimal_val_metrics['precision'] * 100:.2f}% |",
        f"| **Recall (Defective)** | {best_val_metrics['recall'] * 100:.2f}% | {optimal_val_metrics['recall'] * 100:.2f}% |",
        f"| **F1-Score (Defective)** | {best_val_metrics['f1']:.4f} | {optimal_val_metrics['f1']:.4f} |",
        f"| **ROC-AUC** | {best_val_metrics['roc_auc']:.4f} | {optimal_val_metrics['roc_auc']:.4f} |",
        "",
        "> [!NOTE]",
        "> **Evaluation Integrity Check:** The held-out `test.csv` split was **NOT** evaluated during model training or threshold tuning, fully adhering to leakage-free evaluation protocols.",
        "",
        "---",
        "",
        "## 2. Confusion Matrix (Validation Set)",
        "",
        "### At Default Threshold (0.50):",
        "",
        "| | Predicted Good (0) | Predicted Defective (1) | Total Actual |",
        "| :--- | :--- | :--- | :--- |",
        f"| **Actual Good (0)** | **{cm['tn']} (TN)** | {cm['fp']} (FP) | {cm['tn'] + cm['fp']} |",
        f"| **Actual Defective (1)** | {cm['fn']} (FN) | **{cm['tp']} (TP)** | {cm['fn'] + cm['tp']} |",
        f"| **Total Predicted** | {cm['tn'] + cm['fn']} | {cm['fp'] + cm['tp']} | {val_count} |",
        "",
        f"### At Optimal Threshold ({optimal_threshold:.2f}):",
        "",
        "| | Predicted Good (0) | Predicted Defective (1) | Total Actual |",
        "| :--- | :--- | :--- | :--- |",
        f"| **Actual Good (0)** | **{opt_cm['tn']} (TN)** | {opt_cm['fp']} (FP) | {opt_cm['tn'] + opt_cm['fp']} |",
        f"| **Actual Defective (1)** | {opt_cm['fn']} (FN) | **{opt_cm['tp']} (TP)** | {opt_cm['fn'] + opt_cm['tp']} |",
        f"| **Total Predicted** | {opt_cm['tn'] + opt_cm['fn']} | {opt_cm['fp'] + opt_cm['tp']} | {val_count} |",
        "",
        "---",
        "",
        "## 3. Epoch-by-Epoch Progress",
        "",
        "| Epoch | Train Loss | Val Loss | Val Acc | Val Precision | Val Recall | Val F1 | Duration |",
        "| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |",
    ]

    for ep in history["epochs"]:
        lines.append(
            f"| {ep['epoch']} | {ep['train_loss']:.4f} | {ep['val_loss']:.4f} | "
            f"{ep['val_accuracy'] * 100:.2f}% | {ep['val_precision'] * 100:.2f}% | "
            f"{ep['val_recall'] * 100:.2f}% | {ep['val_f1']:.4f} | {ep['duration_sec']:.1f}s |"
        )

    lines.extend([
        "",
        "---",
        "",
        "## 4. Artifacts & Checkpoints",
        "",
        "- Best model checkpoint: `ml/artifacts/best_model.pth`",
        "- Training history JSON: `ml/artifacts/training_history.json`",
        "- Input resolution: `224x224 RGB` with ImageNet normalization",
        "- Preprocessing: Resize to 256x256, CenterCrop to 224x224, Normalize",
        "",
        "---",
        "",
        "## 5. Next Steps for Phase ML-4 (Honest Evaluation)",
        "",
        "1. Load `ml/artifacts/best_model.pth` without updating weights.",
        "2. Evaluate on untouched `ml/data/splits/test.csv` (1,092 primary test images).",
        "3. Generate the final Phase ML-4 evaluation report at `ml/reports/evaluation.md`.",
    ])

    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description="Train EfficientNet-B0 baseline classifier for Inspectra.")
    parser.add_argument(
        "--data-dir",
        type=str,
        default="ml/data/raw/casting_data",
        help="Path to root dataset images directory.",
    )
    parser.add_argument(
        "--splits-dir",
        type=str,
        default="ml/data/splits",
        help="Path to directory containing train.csv and val.csv manifests.",
    )
    parser.add_argument(
        "--artifacts-dir",
        type=str,
        default="ml/artifacts",
        help="Directory to save trained model checkpoints and metadata.",
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=3,
        help="Number of training epochs (default: 3).",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=32,
        help="Batch size (default: 32).",
    )
    parser.add_argument(
        "--lr",
        type=float,
        default=1e-3,
        help="Learning rate for Adam optimizer (default: 1e-3).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=42,
        help="Random seed for reproducibility (default: 42).",
    )
    parser.add_argument(
        "--use-primary-only",
        action="store_true",
        default=True,
        help="Train only on unique primary images, ignoring duplicate copies (default: True).",
    )
    parser.add_argument(
        "--freeze-backbone",
        action="store_true",
        default=True,
        help="Freeze EfficientNet-B0 backbone weights and train classifier head only.",
    )
    parser.add_argument(
        "--report-output",
        type=str,
        default="ml/reports/baseline_training.md",
        help="Path to Markdown training report.",
    )

    args = parser.parse_args()

    set_seed(args.seed)

    data_dir = Path(args.data_dir).resolve()
    splits_dir = Path(args.splits_dir).resolve()
    artifacts_dir = Path(args.artifacts_dir).resolve()
    report_output = Path(args.report_output).resolve()

    train_csv = splits_dir / "train.csv"
    val_csv = splits_dir / "val.csv"

    if not train_csv.exists() or not val_csv.exists():
        raise FileNotFoundError(
            f"Missing manifests in {splits_dir}. Run create_splits.py first."
        )

    artifacts_dir.mkdir(parents=True, exist_ok=True)
    report_output.parent.mkdir(parents=True, exist_ok=True)

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print("=" * 60)
    print("Starting Inspectra Baseline Model Training (Phase ML-3)")
    print("=" * 60)
    print(f"Device:           {device}")
    print(f"Dataset root:     {data_dir}")
    print(f"Training split:   {train_csv}")
    print(f"Validation split: {val_csv}")
    print(f"Artifacts output: {artifacts_dir}")
    print(f"Random seed:      {args.seed}")
    print(f"Epochs:           {args.epochs}")
    print(f"Batch size:       {args.batch_size}")
    print(f"Learning rate:    {args.lr}")
    print(f"Primary only:     {args.use_primary_only}")
    print(f"Freeze backbone:  {args.freeze_backbone}")

    # Build datasets and loaders
    train_transform = get_transforms(is_train=True, image_size=224)
    val_transform = get_transforms(is_train=False, image_size=224)

    train_ds = CastingManifestDataset(
        manifest_path=train_csv,
        data_dir=data_dir,
        transform=train_transform,
        use_primary_only=args.use_primary_only,
    )
    val_ds = CastingManifestDataset(
        manifest_path=val_csv,
        data_dir=data_dir,
        transform=val_transform,
        use_primary_only=args.use_primary_only,
    )

    print(f"\nLoaded {len(train_ds)} train samples and {len(val_ds)} validation samples.")

    train_loader = DataLoader(
        train_ds,
        batch_size=args.batch_size,
        shuffle=True,
        num_workers=0,  # Windows-friendly
    )
    val_loader = DataLoader(
        val_ds,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=0,
    )

    # Initialize model
    print("\nInitializing EfficientNet-B0 with ImageNet pretrained weights...")
    model = build_classifier(
        pretrained=True,
        freeze_backbone=args.freeze_backbone,
        num_classes=1,
        dropout=0.2,
    ).to(device)

    trainable_params = sum(p.numel() for p in model.parameters() if p.requires_grad)
    total_params = sum(p.numel() for p in model.parameters())
    print(f"Total parameters:     {total_params:,}")
    print(f"Trainable parameters: {trainable_params:,} (classifier head)")

    criterion = nn.BCEWithLogitsLoss()
    optimizer = torch.optim.Adam(
        filter(lambda p: p.requires_grad, model.parameters()),
        lr=args.lr,
    )

    history = {"epochs": []}
    best_val_f1 = -1.0
    best_val_metrics = {}
    best_epoch = 0

    print("\nStarting training loop...")
    for epoch in range(1, args.epochs + 1):
        t0 = time.time()
        train_loss = train_one_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_true, val_probs = evaluate_model(model, val_loader, criterion, device)
        duration = time.time() - t0

        val_metrics = compute_binary_metrics(val_true, val_probs, threshold=0.5)

        epoch_record = {
            "epoch": epoch,
            "train_loss": round(train_loss, 4),
            "val_loss": round(val_loss, 4),
            "val_accuracy": val_metrics["accuracy"],
            "val_precision": val_metrics["precision"],
            "val_recall": val_metrics["recall"],
            "val_f1": val_metrics["f1"],
            "val_roc_auc": val_metrics["roc_auc"],
            "duration_sec": round(duration, 2),
        }
        history["epochs"].append(epoch_record)

        print(
            f"Epoch {epoch:2d}/{args.epochs:2d} [{duration:5.1f}s] | "
            f"Train Loss: {train_loss:.4f} | Val Loss: {val_loss:.4f} | "
            f"Val Acc: {val_metrics['accuracy']*100:5.2f}% | "
            f"Val F1: {val_metrics['f1']:.4f} | "
            f"Val Rec: {val_metrics['recall']*100:5.2f}%"
        )

        # Check for best model based on validation F1
        if val_metrics["f1"] > best_val_f1:
            best_val_f1 = val_metrics["f1"]
            best_val_metrics = val_metrics
            best_epoch = epoch

            # Save checkpoint
            checkpoint = {
                "epoch": epoch,
                "model_state_dict": model.state_dict(),
                "optimizer_state_dict": optimizer.state_dict(),
                "val_metrics": val_metrics,
                "config": {
                    "architecture": "efficientnet_b0",
                    "num_classes": 1,
                    "positive_class": "defective",
                    "negative_class": "good",
                    "label_to_idx": LABEL_TO_IDX,
                    "idx_to_label": IDX_TO_LABEL,
                    "seed": args.seed,
                },
            }
            torch.save(checkpoint, artifacts_dir / "best_model.pth")
            print(f"  --> Saved new best checkpoint at epoch {epoch} (F1 = {best_val_f1:.4f})")

    # Threshold optimization on the best model
    print("\nRunning post-training threshold optimization on validation set...")
    # Load best checkpoint
    best_checkpoint = torch.load(artifacts_dir / "best_model.pth", map_location=device, weights_only=False)
    model.load_state_dict(best_checkpoint["model_state_dict"])
    _, val_true, val_probs = evaluate_model(model, val_loader, criterion, device)

    optimal_thresh, optimal_metrics = find_optimal_threshold(val_true, val_probs, metric="f1")
    print(f"Default threshold (0.50)  F1: {best_val_metrics['f1']:.4f} | Acc: {best_val_metrics['accuracy']*100:.2f}%")
    print(f"Optimal threshold ({optimal_thresh:.2f})  F1: {optimal_metrics['f1']:.4f} | Acc: {optimal_metrics['accuracy']*100:.2f}%")

    # Save full training history & metadata
    full_history = {
        "best_epoch": best_epoch,
        "default_val_metrics": best_val_metrics,
        "optimal_threshold": round(optimal_thresh, 4),
        "optimal_val_metrics": optimal_metrics,
        "training_params": vars(args),
        "epochs": history["epochs"],
    }
    with open(artifacts_dir / "training_history.json", "w", encoding="utf-8") as f:
        json.dump(full_history, f, indent=2)

    # Generate Markdown Report
    report_md = generate_training_report(
        history=history,
        best_val_metrics=best_val_metrics,
        optimal_val_metrics=optimal_metrics,
        optimal_threshold=optimal_thresh,
        train_count=len(train_ds),
        val_count=len(val_ds),
        args=args,
    )
    with open(report_output, "w", encoding="utf-8") as f:
        f.write(report_md)

    print(f"\nTraining complete!")
    print(f"Checkpoint saved to: {artifacts_dir / 'best_model.pth'}")
    print(f"History saved to:    {artifacts_dir / 'training_history.json'}")
    print(f"Report generated:    {report_output}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
