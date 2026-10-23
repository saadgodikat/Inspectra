# Held-Out Test Evaluation Report — Phase ML-4

**Model Architecture:** EfficientNet-B0 (ImageNet-1k pretrained backbone + custom linear head)  
**Model Checkpoint:** `ml/artifacts/best_model.pth`  
**Evaluation Split:** `ml/data/splits/test.csv` (Untouched Held-Out Test Set)  
**Evaluated Primary Test Images:** 1,092  
**Positive Class:** `defective` (Label 1)  
**Negative Class:** `good` (Label 0)  
**Frozen Operating Threshold:** `0.38` (Selected on validation split during Phase ML-3)  
**Cross-Split Data Leakage:** **0.0% (Verified 0 SHA-256 hash collisions with train/val)**  

---

> [!NOTE]
> **Test Set Provenance & Path Prefix Clarification:**  
> In the raw Kaggle source dataset, the original downloaded archive organized files into directories named `train/` and `test/`. Because the original Kaggle split contained 64 cross-split duplicate pairs, our Phase ML-2 data preparation pooled all 7,348 files and grouped identical SHA-256 hashes together before performing stratified splitting.
>
> As a result, the manifested file paths in `ml/data/splits/test.csv` preserve their original relative directory prefixes (e.g., `train\def_front\...` and `test\def_front\...`). Every single sample evaluated in this report belongs strictly to `ml/data/splits/test.csv` and was completely withheld from training and validation.

---

## 1. Executive Summary & Generalization Performance

| Evaluation Metric | Phase ML-3 Validation (Threshold = 0.38) | Phase ML-4 Held-Out Test (Threshold = 0.38) | Phase ML-4 Held-Out Test (Default 0.50) |
| :--- | :--- | :--- | :--- |
| **Accuracy** | 97.07% | **96.15%** | 95.05% |
| **Precision (Defective)** | 97.02% | **96.09%** | 98.16% |
| **Recall (Defective)** | 97.94% | **97.31%** | 93.19% |
| **F1-Score (Defective)** | 0.9748 | **0.9669** | 0.9561 |
| **ROC-AUC** | 0.9944 | **0.9918** | 0.9918 |

> [!IMPORTANT]
> **Honest Evaluation Protocol:** The operating threshold of **0.38** was frozen directly from the validation split without post-test tuning. The model achieved strong, consistent generalization on held-out data with no evidence of test set overfitting.

---

## 2. Confusion Matrix (Held-Out Test Set)

### At Frozen Operating Threshold (0.38):

| | Predicted Good (0) | Predicted Defective (1) | Total Actual |
| :--- | :--- | :--- | :--- |
| **Actual Good (0)** | **436 (TN)** | 25 (FP) | 461 |
| **Actual Defective (1)** | 17 (FN) | **614 (TP)** | 631 |
| **Total Predicted** | 453 | 639 | 1,092 |

- **False Positives (Over-rejection):** 25 samples (5.42% of good parts)
- **False Negatives (Escaped Defect):** 17 samples (2.69% of defective parts)

### At Default Threshold (0.50):

| | Predicted Good (0) | Predicted Defective (1) | Total Actual |
| :--- | :--- | :--- | :--- |
| **Actual Good (0)** | **450 (TN)** | 11 (FP) | 461 |
| **Actual Defective (1)** | 43 (FN) | **588 (TP)** | 631 |
| **Total Predicted** | 493 | 599 | 1,092 |

---

## 3. Error Analysis & Discrepancies

All 17 False Negatives and 25 False Positives listed below come strictly from the held-out test split (`ml/data/splits/test.csv`).

### Sample False Negatives (Critical Escaped Defects):
| Image Path (in `test.csv`) | Manifest Split | Predicted P(Defective) | Threshold |
| :--- | :--- | :--- | :--- |
| `test\def_front\cast_def_0_514.jpeg` | test | 0.2706 | 0.38 |
| `test\def_front\cast_def_0_9921.jpeg` | test | 0.3515 | 0.38 |
| `train\def_front\cast_def_0_2499.jpeg` | test | 0.3002 | 0.38 |
| `train\def_front\cast_def_0_2696.jpeg` | test | 0.3791 | 0.38 |
| `train\def_front\cast_def_0_2866.jpeg` | test | 0.3628 | 0.38 |
| `train\def_front\cast_def_0_4073.jpeg` | test | 0.0488 | 0.38 |
| `train\def_front\cast_def_0_5152.jpeg` | test | 0.0739 | 0.38 |
| `train\def_front\cast_def_0_5325.jpeg` | test | 0.3426 | 0.38 |
| `train\def_front\cast_def_0_6584.jpeg` | test | 0.3599 | 0.38 |
| `train\def_front\cast_def_0_6988.jpeg` | test | 0.0446 | 0.38 |
| *...and 7 more false negatives in test.csv* | test | | |

### Sample False Positives (Good Parts Flagged for Review):
| Image Path (in `test.csv`) | Manifest Split | Predicted P(Defective) | Threshold |
| :--- | :--- | :--- | :--- |
| `test\ok_front\cast_ok_0_2311.jpeg` | test | 0.5684 | 0.38 |
| `test\ok_front\cast_ok_0_2915.jpeg` | test | 0.3995 | 0.38 |
| `train\ok_front\cast_ok_0_1755.jpeg` | test | 0.3912 | 0.38 |
| `train\ok_front\cast_ok_0_2207.jpeg` | test | 0.4929 | 0.38 |
| `train\ok_front\cast_ok_0_2908.jpeg` | test | 0.3906 | 0.38 |
| `train\ok_front\cast_ok_0_2982.jpeg` | test | 0.4061 | 0.38 |
| `train\ok_front\cast_ok_0_316.jpeg` | test | 0.6993 | 0.38 |
| `train\ok_front\cast_ok_0_34.jpeg` | test | 0.4667 | 0.38 |
| `train\ok_front\cast_ok_0_3593.jpeg` | test | 0.4051 | 0.38 |
| `train\ok_front\cast_ok_0_4141.jpeg` | test | 0.5496 | 0.38 |
| *...and 15 more false positives in test.csv* | test | | |

---

## 4. Model Boundaries, Limits & Governance

1. **Binary Scope Only:** The model evaluates binary visual defects on casting surfaces (`defective` vs. `good`). It does not measure dimensional tolerances, internal structural integrity, or metallurgical composition.
2. **Review Suggestion Only:** In accordance with FDA 21 CFR Part 11 and ISO 13485 quality principles, machine learning inferences are strictly decision support suggestions (`unreviewed_ai_flags`). They never constitute a final disposition, cannot close a defect, and cannot release a production batch.
3. **Safe Failure & Resilience:** If model weights are missing or inference encounters an unreadable file or corruption, the application gracefully captures the error in `processing_failed` state without deleting the inspection, uploaded image, or existing human observations.
