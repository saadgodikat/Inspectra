# Leakage-Safe Dataset Splits Report — Phase ML-2

**Dataset Location:** `C:\Users\hp\Desktop\Inspectra-main\Inspectra\ml\data\raw\casting_data`
**Manifests Location:** `C:\Users\hp\Desktop\Inspectra-main\Inspectra\ml\data\splits`
**Random Seed:** `42`
**Target Ratios:** Train=0.7, Val=0.15, Test=0.15
**Cross-Split Leakage:** **0.0% (VERIFIED ZERO LEAKAGE)**

---

## 1. Executive Summary & Duplicate Isolation

| Metric | Total Count | Percentage |
| :--- | :--- | :--- |
| **Total Files Manifested** | 7348 | 100.0% |
| **Unique Image Hashes (Content)** | 7284 | 99.13% |
| **Exact Duplicate Groups** | 64 | — |
| **Redundant Duplicate Files** | 64 | 0.87% |
| **Cross-Split Duplicate Groups** | **0** | **0.0% (Leakage Eliminated)** |

> [!IMPORTANT]
> **Duplicate Grouping Guarantee:** All files sharing an identical SHA-256 hash were grouped together before stratification and assigned to the same split. No image appears in both train and validation/test.

---

## 2. Split Partition Breakdown

| Split | Total Files | Unique Hashes | Split % (Unique) | Defective Hashes | Good Hashes | Defective % | Good % |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `train` | 5147 | 5099 | 70.0% | 2948 | 2151 | 57.82% | 42.18% |
| `val` | 1100 | 1093 | 15.01% | 632 | 461 | 57.82% | 42.18% |
| `test` | 1101 | 1092 | 14.99% | 631 | 461 | 57.78% | 42.22% |

---

## 3. Duplicate Files Allocation by Split

| Split | Duplicate Files in Split | Duplicate Groups in Split | Cross-Split Leaks |
| :--- | :--- | :--- | :--- |
| `train` | 96 | 48 | **0** |
| `val` | 14 | 7 | **0** |
| `test` | 18 | 9 | **0** |

---

## 4. Dataset Limitations & Pre-Split Flaws

1. **Original Kaggle Split Defect:** The author-supplied `train/` and `test/` folders contained 64 identical image pairs in `ok_front/`. Directly training on `train` and testing on `test` would have artificially inflated accuracy and recall for the `good` class due to memorized test samples.
2. **New Manifest Replacement:** Rather than physically deleting or modifying the raw images, the new `ml/data/splits/manifest.csv` assigns files into genuine, non-leaking partitions while preserving raw dataset integrity.
3. **Physical Item Disconnect:** The Kaggle casting dataset does not provide serial numbers or part identifiers to trace multiple photos of the same physical casting. Splitting is grouped strictly by SHA-256 byte identity.

---

## 5. Instructions for Phase ML-3 (Model Training)

Load split manifests directly using pandas or Python's `csv` module:
```python
import pandas as pd

# Recommended: Train on all train files (or unique primary images):
train_df = pd.read_csv('ml/data/splits/train.csv')
val_df = pd.read_csv('ml/data/splits/val.csv')
test_df = pd.read_csv('ml/data/splits/test.csv')
```
