# Inspectra Multiclass Defect Classifier — Test Evaluation Report

**Model Checkpoint:** `ml/artifacts/multiclass_defect_model.pth`  
**Test Split Manifest:** `ml/data/splits_multiclass/test.csv`  
**Evaluation Date:** 2026-10-22 23:06:23  
**Evaluation Device:** `cpu`  

---

## 1. Overall Performance Summary

| Metric | Score |
| :--- | :--- |
| **Test Accuracy** | **84.15%** |
| **Macro Precision** | **0.8467** |
| **Macro Recall** | **0.8102** |
| **Macro F1-Score** | **0.8143** |
| **Total Test Samples** | 183 |
| **Correct Predictions** | 154 |
| **Misclassified Samples** | 29 |

---

## 2. Per-Class Performance Breakdown

| Class Name | Class ID | Precision | Recall | F1-Score | Support |
| :--- | :---: | :---: | :---: | :---: | :---: |
| `GOOD` | 0 | 1.0000 | 1.0000 | 1.0000 | 30 |
| `CRACK` | 1 | 0.5208 | 0.8065 | 0.6329 | 31 |
| `DENT` | 2 | 0.9231 | 0.7273 | 0.8136 | 33 |
| `SCRATCH` | 3 | 0.7895 | 0.5172 | 0.6250 | 29 |
| `OTHER_DEFECT` | 4 | 1.0000 | 1.0000 | 1.0000 | 60 |

---

## 3. Confusion Matrix

```
True \ Pred    GOOD   CRACK    DENT   SCRAT   OTHER
      GOOD      30       0       0       0       0
     CRACK       0      25       2       4       0
      DENT       0       9      24       0       0
     SCRAT       0      14       0      15       0
     OTHER       0       0       0       0      60
```

---

## 4. Misclassified Samples (Sample of up to 10)

| Image Path | Ground Truth | Predicted | Confidence |
| :--- | :--- | :--- | :--- |
| `ml/data/external/synthetic_industrial_defects/images/defect_00582.png` | `CRACK` | `DENT` | 0.3812 |
| `ml/data/external/synthetic_industrial_defects/images/defect_00227.png` | `CRACK` | `SCRATCH` | 0.4273 |
| `ml/data/external/synthetic_industrial_defects/images/defect_00725.png` | `CRACK` | `SCRATCH` | 0.3682 |
| `ml/data/external/synthetic_industrial_defects/images/defect_00994.png` | `CRACK` | `SCRATCH` | 0.4960 |
| `ml/data/external/synthetic_industrial_defects/images/defect_00651.png` | `CRACK` | `SCRATCH` | 0.4158 |
| `ml/data/external/synthetic_industrial_defects/images/defect_00085.png` | `CRACK` | `DENT` | 0.3330 |
| `ml/data/external/synthetic_industrial_defects/images/defect_00318.png` | `DENT` | `CRACK` | 0.6601 |
| `ml/data/external/synthetic_industrial_defects/images/defect_00159.png` | `DENT` | `CRACK` | 0.4415 |
| `ml/data/external/synthetic_industrial_defects/images/defect_00538.png` | `DENT` | `CRACK` | 0.4703 |
| `ml/data/external/synthetic_industrial_defects/images/defect_00520.png` | `DENT` | `CRACK` | 0.5548 |

---

## 5. Disclosures and Engineering Notes

1. **Synthetic Training Data Disclosure:**  
   Defect images were drawn from synthetic metal anomaly datasets. Performance on real production defects may require domain adaptation or calibration with actual physical parts.

2. **Classification vs. Detection:**  
   This evaluation reflects image-level classification into 5 distinct quality categories (`GOOD`, `CRACK`, `DENT`, `SCRATCH`, `OTHER_DEFECT`). It does not compute object detection bounding boxes or defect coordinates.
