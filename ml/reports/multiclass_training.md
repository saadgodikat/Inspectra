# Inspectra Multiclass Defect Classifier — Training Report

**Model Architecture:** EfficientNet-B0 (pretrained ImageNet-1k, frozen backbone)  
**Task:** 5-Class Industrial Defect Classification  
**Classes:** 0: GOOD, 1: CRACK, 2: DENT, 3: SCRATCH, 4: OTHER_DEFECT  
**Training Date:** 2026-10-22 23:05:13  
**Checkpoint Path:** `ml/artifacts/multiclass_defect_model.pth`  

---

## 1. Executive Training Summary

| Metric | Value |
| :--- | :--- |
| **Total Epochs** | 5 |
| **Best Epoch** | 4 |
| **Best Val Accuracy** | 82.95% |
| **Best Val Macro F1** | 0.7965 |
| **Best Val Loss** | 0.4366 |
| **Training Duration** | 208.7 seconds |
| **Device Used** | cpu |

---

## 2. Epoch-by-Epoch Progress

| Epoch | Train Loss | Val Loss | Val Accuracy | Val Macro F1 |
| :---: | :---: | :---: | :---: | :---: |
| 1 | 0.9197 | 0.5662 | 80.11% | 0.7621 |
| 2 | 0.5630 | 0.4720 | 82.39% | 0.7926 |
| 3 | 0.5049 | 0.4558 | 81.25% | 0.7759 |
| 4 *(Best)* | 0.4820 | 0.4366 | 82.95% | 0.7965 |
| 5 | 0.4608 | 0.4374 | 81.82% | 0.7848 |

---

## 3. Disclosures & Boundaries

1. **Synthetic Data Disclosure:**  
   Defect images are sourced from the synthetic industrial metal surface dataset (`xanoutas/synthetic-industrial-defects-teaser`). Model metrics on synthetic textures do not guarantee identical performance on real manufacturing production lines without domain adaptation.

2. **Classification Scope:**  
   This model performs image-level multi-class classification, outputting softmax probabilities over the 5 defined classes. It does not perform defect bounding box localization or object detection.
