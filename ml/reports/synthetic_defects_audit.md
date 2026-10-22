# Synthetic Industrial Defects Dataset Audit Report

**Dataset Location:** `C:\Users\hp\Desktop\Inspectra-main\Inspectra\ml\data\external\synthetic_industrial_defects`  
**Dataset Source:** Hugging Face `xanoutas/synthetic-industrial-defects-teaser`  
**License:** MIT  
**Date of Audit:** 2026-10-22  
**Audit Status:** AUDITED — ACTION REQUIRED FOR CLASS MAPPING  

---

## 1. Executive Summary

| Metric | Value | Notes |
| :--- | :--- | :--- |
| **Total PNG Images Found** | 991 | Expected sequence: 1,000 files |
| **Total TXT Label Files Found** | 991 | 100% matched to image filenames |
| **Missing Image Files** | 0 | All label files have matching images |
| **Missing Label Files** | 0 | All image files have matching labels |
| **Missing Indices from 1,000** | 9 | Missing upstream: `defect_00004, defect_00051, defect_00284, defect_00486, defect_00573, defect_00613, defect_00656, defect_00680, defect_00945` |
| **Corrupt / Unreadable Images** | 0 | 0 corrupt images detected |
| **Exact Duplicate Images (SHA-256)** | 0 | 0 duplicate images detected |
| **Empty Annotation Files** | 0 | 0 empty files; all images have defect bounding boxes |
| **Images with Multi-Class Defects** | 0 | 0 images; every image contains exactly one defect class |
| **Total Bounding Box Annotations** | 1690 | YOLO format `(cls, x, y, w, h)` |

---

## 2. Image Characteristics

| Property | Value | Distribution |
| :--- | :--- | :--- |
| **Resolution** | 1024 x 768 | 991 / 991 (100.0%) |
| **Color Mode** | RGBA | 991 / 991 (100.0%) |
| **Format** | PNG | 991 / 991 (100.0%) |

---

## 3. Class ID Distribution

| Class ID | Image Count | Image % | Total Box Annotations | Avg Boxes / Image |
| :--- | :--- | :--- | :--- | :--- |
| **0** | 184 | 18.57% | 184 | 1.00 |
| **1** | 215 | 21.70% | 215 | 1.00 |
| **2** | 199 | 20.08% | 898 | 4.51 |
| **3** | 206 | 20.79% | 206 | 1.00 |
| **4** | 187 | 18.87% | 187 | 1.00 |
| **Total** | **991** | **100.00%** | **1690** | **1.71** |

---

## 4. Bounding Box Distribution per Image

| Boxes per Image | Image Count | % of Dataset |
| :--- | :--- | :--- |
| **1 Box** | 792 | 79.92% |
| **3 Boxes** | 48 | 4.84% |
| **4 Boxes** | 52 | 5.25% |
| **5 Boxes** | 48 | 4.84% |
| **6 Boxes** | 51 | 5.15% |

---

## 5. Critical Findings & Data Integrity Assessment

1. **Defect-Only Dataset:**  
   The dataset contains **0 defect-free (good) images**. All 991 images represent defective surfaces with active defect bounding boxes. To train a 5-class model including `GOOD`, defect-free negative samples must be provided (e.g. from the existing casting inspection dataset `ml/data/raw/casting_data/train/ok_front/`).

2. **Absence of Authoritative Class-ID-to-Name Mapping:**  
   The upstream Hugging Face repository (`xanoutas/synthetic-industrial-defects-teaser`) and local files contain only `README.md` listing 5 defect types:
   `- scratch, dent, crack, corrosion, discoloration`  
   Neither `data.yaml`, `classes.txt`, nor dataset metadata specifies the explicit numeric assignment for Class IDs 0 through 4.
   
3. **Single-Label Integrity:**  
   Every image in the dataset belongs strictly to a single defect class (0 images with mixed classes), making single-label classification clean and unambiguous once class IDs are mapped.

4. **Recommendation:**  
   Per project policy, training must not proceed on assumed class ID mappings. The user must confirm or provide the authoritative class ID mapping before model training.
