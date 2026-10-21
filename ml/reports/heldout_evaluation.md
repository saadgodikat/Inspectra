# Held-Out Test Evaluation Report â€” Phase ML-4

**Model Checkpoint:** `C:\Users\hp\Desktop\Inspectra-main\Inspectra\ml\artifacts\best_model.pth`
**Evaluation Split:** `ml/data/splits/test.csv` (Untouched Held-Out Test Set)
**Evaluated Primary Test Images:** 1092
**Positive Class:** `defective` (Label 1)
**Negative Class:** `good` (Label 0)
**Frozen Operating Threshold:** `0.38` (Selected on validation during Phase ML-3)
**Cross-Split Data Leakage:** **0.0% (Verified 0 hash collisions with train/val)**

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
> **Honest Evaluation Protocol:** The operating threshold of **0.38** was frozen directly from validation without post-test tuning. The model achieved strong, consistent generalization on held-out data with no evidence of test set overfitting.

---

## 2. Confusion Matrix (Held-Out Test Set)

### At Frozen Operating Threshold (0.38):

| | Predicted Good (0) | Predicted Defective (1) | Total Actual |
| :--- | :--- | :--- | :--- |
| **Actual Good (0)** | **436 (TN)** | 25 (FP) | 461 |
| **Actual Defective (1)** | 17 (FN) | **614 (TP)** | 631 |
| **Total Predicted** | 453 | 639 | 1092 |

- **False Positives (Over-rejection):** 25 samples (5.42% of good parts)
- **False Negatives (Escaped Defect):** 17 samples (2.69% of defective parts)

### At Default Threshold (0.50):

| | Predicted Good (0) | Predicted Defective (1) | Total Actual |
| :--- | :--- | :--- | :--- |
| **Actual Good (0)** | **450 (TN)** | 11 (FP) | 461 |
| **Actual Defective (1)** | 43 (FN) | **588 (TP)** | 631 |
| **Total Predicted** | 493 | 599 | 1092 |

---

## 3. Error Analysis & Discrepancies

- Total False Positives: 25
- Total False Negatives: 17

### Sample False Negatives (Critical Escaped Defects):
| Image Path | Predicted P(Defective) | Threshold |
| :--- | :--- | :--- |
| `test\def_front\cast_def_0_514.jpeg` | 0.2706 | 0.38 |
| `test\def_front\cast_def_0_9921.jpeg` | 0.3515 | 0.38 |
| `train\def_front\cast_def_0_2499.jpeg` | 0.3002 | 0.38 |
| `train\def_front\cast_def_0_2696.jpeg` | 0.3791 | 0.38 |
| `train\def_front\cast_def_0_2866.jpeg` | 0.3628 | 0.38 |
| `train\def_front\cast_def_0_4073.jpeg` | 0.0488 | 0.38 |
| `train\def_front\cast_def_0_5152.jpeg` | 0.0739 | 0.38 |
| `train\def_front\cast_def_0_5325.jpeg` | 0.3426 | 0.38 |
| `train\def_front\cast_def_0_6584.jpeg` | 0.3599 | 0.38 |
| `train\def_front\cast_def_0_6988.jpeg` | 0.0446 | 0.38 |
| *...and 7 more false negatives* | | |

### Sample False Positives (Good Parts Flagged for Review):
| Image Path | Predicted P(Defective) | Threshold |
| :--- | :--- | :--- |
| `test\ok_front\cast_ok_0_2311.jpeg` | 0.5684 | 0.38 |
| `test\ok_front\cast_ok_0_2915.jpeg` | 0.3995 | 0.38 |
| `train\ok_front\cast_ok_0_1755.jpeg` | 0.3912 | 0.38 |
| `train\ok_front\cast_ok_0_2207.jpeg` | 0.4929 | 0.38 |
| `train\ok_front\cast_ok_0_2908.jpeg` | 0.3906 | 0.38 |
| `train\ok_front\cast_ok_0_2982.jpeg` | 0.4061 | 0.38 |
| `train\ok_front\cast_ok_0_316.jpeg` | 0.6993 | 0.38 |
| `train\ok_front\cast_ok_0_34.jpeg` | 0.4667 | 0.38 |
| `train\ok_front\cast_ok_0_3593.jpeg` | 0.4051 | 0.38 |
| `train\ok_front\cast_ok_0_4141.jpeg` | 0.5496 | 0.38 |
| *...and 15 more false positives* | | |

---

## 4. Architectural Readiness for Phase ML-5 (Backend Integration)

1. **Contract Compatibility:** The binary predictions, probabilities, and class semantics match the Flask `MLResult` schema.
2. **Production Threshold:** Recommend deploying with the frozen threshold of `0.38` to maximize recall of genuine casting defects in automated quality inspection.
3. **Inference Interface:** Ready to be wrapped in a clean, decoupled inference module (`predict_image`) for backend integration.
