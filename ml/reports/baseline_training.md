# Baseline Defect Classifier Training Report â€” Phase ML-3

**Model Architecture:** `EfficientNet-B0` (Pretrained on ImageNet-1k, Linear Probing Head)
**Target Task:** Binary Defect Classification (`good` vs `defective`)
**Positive Class:** `defective` (Label 1)
**Negative Class:** `good` (Label 0)
**Training Set Size:** 5099 unique primary images
**Validation Set Size:** 1093 unique primary images
**Random Seed:** `42`
**Epochs:** 3 | **Batch Size:** 64 | **LR:** 0.001

---

## 1. Executive Summary

| Metric | Validation (Default Threshold = 0.50) | Validation (Optimized Threshold = 0.38) |
| :--- | :--- | :--- |
| **Accuracy** | 95.97% | 97.07% |
| **Precision (Defective)** | 98.51% | 97.02% |
| **Recall (Defective)** | 94.46% | 97.94% |
| **F1-Score (Defective)** | 0.9645 | 0.9748 |
| **ROC-AUC** | 0.9944 | 0.9944 |

> [!NOTE]
> **Evaluation Integrity Check:** The held-out `test.csv` split was **NOT** evaluated during model training or threshold tuning, fully adhering to leakage-free evaluation protocols.

---

## 2. Confusion Matrix (Validation Set)

### At Default Threshold (0.50):

| | Predicted Good (0) | Predicted Defective (1) | Total Actual |
| :--- | :--- | :--- | :--- |
| **Actual Good (0)** | **452 (TN)** | 9 (FP) | 461 |
| **Actual Defective (1)** | 35 (FN) | **597 (TP)** | 632 |
| **Total Predicted** | 487 | 606 | 1093 |

### At Optimal Threshold (0.38):

| | Predicted Good (0) | Predicted Defective (1) | Total Actual |
| :--- | :--- | :--- | :--- |
| **Actual Good (0)** | **442 (TN)** | 19 (FP) | 461 |
| **Actual Defective (1)** | 13 (FN) | **619 (TP)** | 632 |
| **Total Predicted** | 455 | 638 | 1093 |

---

## 3. Epoch-by-Epoch Progress

| Epoch | Train Loss | Val Loss | Val Acc | Val Precision | Val Recall | Val F1 | Duration |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | 0.4629 | 0.3104 | 91.86% | 97.38% | 88.29% | 0.9261 | 94.2s |
| 2 | 0.2915 | 0.2111 | 95.15% | 98.33% | 93.20% | 0.9569 | 93.3s |
| 3 | 0.2282 | 0.1684 | 95.97% | 98.51% | 94.46% | 0.9645 | 96.2s |

---

## 4. Artifacts & Checkpoints

- Best model checkpoint: `ml/artifacts/best_model.pth`
- Training history JSON: `ml/artifacts/training_history.json`
- Input resolution: `224x224 RGB` with ImageNet normalization
- Preprocessing: Resize to 256x256, CenterCrop to 224x224, Normalize

---

## 5. Next Steps for Phase ML-4 (Honest Evaluation)

1. Load `ml/artifacts/best_model.pth` without updating weights.
2. Evaluate on untouched `ml/data/splits/test.csv` (1,092 primary test images).
3. Generate the final Phase ML-4 evaluation report at `ml/reports/evaluation.md`.
