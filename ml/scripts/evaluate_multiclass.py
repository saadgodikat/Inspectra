"""Evaluate the Multiclass Defect Classifier on the held-out test split.

Generates:
- Overall test accuracy
- Macro precision, recall, F1-score
- Per-class breakdown (precision, recall, F1, support)
- 5x5 Confusion matrix
- Classification report
- Misclassified sample analysis
- Saves artifacts/multiclass_evaluation_metrics.json and reports/multiclass_evaluation.md
"""

import os
import sys
import json
import time
import argparse
from pathlib import Path
from typing import Dict, Any, List
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
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report,
)

from inspectra_ml.dataset import (
    MulticlassManifestDataset,
    get_transforms,
    MULTICLASS_LABEL_TO_IDX,
    MULTICLASS_IDX_TO_LABEL,
)
from inspectra_ml.model import build_classifier


def parse_args():
    parser = argparse.ArgumentParser(description="Evaluate multiclass defect classifier")
    parser.add_argument(
        "--checkpoint",
        type=str,
        default="ml/artifacts/multiclass_defect_model.pth",
        help="Path to trained model checkpoint",
    )
    parser.add_argument(
        "--test-manifest",
        type=str,
        default="ml/data/splits_multiclass/test.csv",
        help="Path to test manifest CSV",
    )
    parser.add_argument(
        "--batch-size", type=int, default=16, help="Batch size for evaluation"
    )
    parser.add_argument(
        "--output-metrics",
        type=str,
        default="ml/artifacts/multiclass_evaluation_metrics.json",
        help="JSON output path for metrics",
    )
    parser.add_argument(
        "--report-path",
        type=str,
        default="ml/reports/multiclass_evaluation.md",
        help="Markdown report path",
    )
    return parser.parse_args()


@torch.no_grad()
def main():
    args = parse_args()
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Using evaluation device: {device}")

    ckpt_path = REPO_ROOT / args.checkpoint
    if not ckpt_path.exists():
        raise FileNotFoundError(f"Checkpoint not found at: {ckpt_path}")

    checkpoint = torch.load(ckpt_path, map_location=device, weights_only=False)
    config = checkpoint.get("config", {})
    num_classes = config.get("num_classes", 5)

    model = build_classifier(
        pretrained=False,
        freeze_backbone=True,
        num_classes=num_classes,
    ).to(device)
    model.load_state_dict(checkpoint["model_state_dict"])
    model.eval()

    test_manifest = REPO_ROOT / args.test_manifest
    if not test_manifest.exists():
        raise FileNotFoundError(f"Test manifest not found at: {test_manifest}")

    eval_transform = get_transforms(is_train=False, image_size=224)
    test_dataset = MulticlassManifestDataset(
        manifest_path=test_manifest,
        repo_root=REPO_ROOT,
        transform=eval_transform,
    )
    test_loader = DataLoader(
        test_dataset,
        batch_size=args.batch_size,
        shuffle=False,
        num_workers=0,
    )

    print(f"Loaded {len(test_dataset)} test samples from {test_manifest}")

    all_true = []
    all_pred = []
    all_probs = []
    misclassified = []

    t0 = time.time()
    for batch_idx, (images, labels, paths) in enumerate(test_loader):
        images = images.to(device)
        logits = model(images)
        probs = torch.softmax(logits, dim=1)
        preds = torch.argmax(probs, dim=1)

        y_true_batch = labels.cpu().numpy()
        y_pred_batch = preds.cpu().numpy()
        probs_batch = probs.cpu().numpy()

        all_true.extend(y_true_batch)
        all_pred.extend(y_pred_batch)
        all_probs.extend(probs_batch)

        for i in range(len(y_true_batch)):
            if y_true_batch[i] != y_pred_batch[i]:
                misclassified.append({
                    "path": paths[i],
                    "true_class": MULTICLASS_IDX_TO_LABEL[int(y_true_batch[i])],
                    "pred_class": MULTICLASS_IDX_TO_LABEL[int(y_pred_batch[i])],
                    "confidence": float(probs_batch[i][y_pred_batch[i]]),
                })

    eval_sec = time.time() - t0
    y_true = np.array(all_true)
    y_pred = np.array(all_pred)

    # Compute metrics
    acc = accuracy_score(y_true, y_pred)
    macro_prec = precision_score(y_true, y_pred, average="macro", zero_division=0)
    macro_rec = recall_score(y_true, y_pred, average="macro", zero_division=0)
    macro_f1 = f1_score(y_true, y_pred, average="macro", zero_division=0)

    class_names = [MULTICLASS_IDX_TO_LABEL[i] for i in range(num_classes)]
    prec_per_class = precision_score(y_true, y_pred, average=None, zero_division=0)
    rec_per_class = recall_score(y_true, y_pred, average=None, zero_division=0)
    f1_per_class = f1_score(y_true, y_pred, average=None, zero_division=0)

    cm = confusion_matrix(y_true, y_pred, labels=list(range(num_classes)))
    clf_report = classification_report(
        y_true,
        y_pred,
        target_names=class_names,
        digits=4,
        zero_division=0,
    )

    print(f"\n--- Multiclass Test Evaluation Results ---")
    print(f"Overall Accuracy:  {acc*100:.2f}%")
    print(f"Macro Precision:   {macro_prec:.4f}")
    print(f"Macro Recall:      {macro_rec:.4f}")
    print(f"Macro F1-Score:    {macro_f1:.4f}")
    print("\nClassification Report:\n", clf_report)
    print("\nConfusion Matrix:\n", cm)

    # Save metrics JSON
    metrics_data = {
        "overall": {
            "accuracy": float(acc),
            "macro_precision": float(macro_prec),
            "macro_recall": float(macro_rec),
            "macro_f1": float(macro_f1),
            "total_test_samples": int(len(y_true)),
            "misclassified_count": int(len(misclassified)),
            "evaluation_duration_sec": round(eval_sec, 2),
        },
        "per_class": {
            class_names[i]: {
                "precision": float(prec_per_class[i]),
                "recall": float(rec_per_class[i]),
                "f1_score": float(f1_per_class[i]),
                "support": int(np.sum(y_true == i)),
            }
            for i in range(num_classes)
        },
        "confusion_matrix": cm.tolist(),
        "misclassified": misclassified,
    }

    out_metrics_path = REPO_ROOT / args.output_metrics
    out_metrics_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_metrics_path, "w", encoding="utf-8") as f:
        json.dump(metrics_data, f, indent=2)
    print(f"\nSaved evaluation metrics to: {out_metrics_path}")

    # Generate Markdown Report
    rep_path = REPO_ROOT / args.report_path
    rep_path.parent.mkdir(parents=True, exist_ok=True)

    report_md = f"""# Inspectra Multiclass Defect Classifier — Test Evaluation Report

**Model Checkpoint:** `{args.checkpoint}`  
**Test Split Manifest:** `{args.test_manifest}`  
**Evaluation Date:** {time.strftime('%Y-%m-%d %H:%M:%S')}  
**Evaluation Device:** `{device}`  

---

## 1. Overall Performance Summary

| Metric | Score |
| :--- | :--- |
| **Test Accuracy** | **{acc*100:.2f}%** |
| **Macro Precision** | **{macro_prec:.4f}** |
| **Macro Recall** | **{macro_rec:.4f}** |
| **Macro F1-Score** | **{macro_f1:.4f}** |
| **Total Test Samples** | {len(y_true)} |
| **Correct Predictions** | {len(y_true) - len(misclassified)} |
| **Misclassified Samples** | {len(misclassified)} |

---

## 2. Per-Class Performance Breakdown

| Class Name | Class ID | Precision | Recall | F1-Score | Support |
| :--- | :---: | :---: | :---: | :---: | :---: |
"""
    for i, cname in enumerate(class_names):
        supp = int(np.sum(y_true == i))
        report_md += (
            f"| `{cname}` | {i} | {prec_per_class[i]:.4f} | "
            f"{rec_per_class[i]:.4f} | {f1_per_class[i]:.4f} | {supp} |\n"
        )

    report_md += f"""
---

## 3. Confusion Matrix

```
True \\ Pred   {'   '.join([f'{c[:5]:>5}' for c in class_names])}
"""
    for i, row in enumerate(cm):
        c_short = class_names[i][:5]
        row_str = "   ".join([f"{val:>5}" for val in row])
        report_md += f"{c_short:>10}   {row_str}\n"

    report_md += f"""```

---

## 4. Misclassified Samples (Sample of up to 10)

| Image Path | Ground Truth | Predicted | Confidence |
| :--- | :--- | :--- | :--- |
"""
    for item in misclassified[:10]:
        report_md += f"| `{item['path']}` | `{item['true_class']}` | `{item['pred_class']}` | {item['confidence']:.4f} |\n"

    if len(misclassified) == 0:
        report_md += "| *(None — 100% correct test predictions)* | — | — | — |\n"

    report_md += f"""
---

## 5. Disclosures and Engineering Notes

1. **Synthetic Training Data Disclosure:**  
   Defect images were drawn from synthetic metal anomaly datasets. Performance on real production defects may require domain adaptation or calibration with actual physical parts.

2. **Classification vs. Detection:**  
   This evaluation reflects image-level classification into 5 distinct quality categories (`GOOD`, `CRACK`, `DENT`, `SCRATCH`, `OTHER_DEFECT`). It does not compute object detection bounding boxes or defect coordinates.
"""

    with open(rep_path, "w", encoding="utf-8") as f:
        f.write(report_md)
    print(f"Saved evaluation markdown report to: {rep_path}")


if __name__ == "__main__":
    main()
