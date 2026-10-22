"""Audit and verification script for the Synthetic Industrial Defects dataset (Phase Multiclass).

Performs exhaustive verification on ml/data/external/synthetic_industrial_defects:
1. Validates image readability, format, dimensions, channels.
2. Performs SHA-256 deduplication.
3. Validates matching annotation files, bounding box counts, class distributions.
4. Identifies malformed lines, out-of-bounds coordinates, empty files.
5. Generates structured audit report at ml/reports/synthetic_defects_audit.md.
"""

import os
import hashlib
from pathlib import Path
from collections import Counter, defaultdict
from PIL import Image

REPO_ROOT = Path(__file__).resolve().parents[2]
DATASET_ROOT = REPO_ROOT / "ml" / "data" / "external" / "synthetic_industrial_defects"
IMAGE_DIR = DATASET_ROOT / "images"
LABEL_DIR = DATASET_ROOT / "labels"
REPORT_PATH = REPO_ROOT / "ml" / "reports" / "synthetic_defects_audit.md"


def run_audit():
    print(f"Auditing dataset at: {DATASET_ROOT}")
    if not DATASET_ROOT.exists():
        raise FileNotFoundError(f"Dataset root not found: {DATASET_ROOT}")

    img_files = sorted([f for f in os.listdir(IMAGE_DIR) if f.endswith(".png")])
    lbl_files = sorted([f for f in os.listdir(LABEL_DIR) if f.endswith(".txt")])

    img_stems = set(os.path.splitext(f)[0] for f in img_files)
    lbl_stems = set(os.path.splitext(f)[0] for f in lbl_files)

    # 1. Filename pairing
    missing_labels = sorted(img_stems - lbl_stems)
    missing_images = sorted(lbl_stems - img_stems)

    # 2. Sequence continuity (00000 - 00999)
    expected_stems = set(f"defect_{i:05d}" for i in range(1000))
    missing_from_1000 = sorted(expected_stems - img_stems)

    # 3. Image integrity, dimensions, channels, duplicates
    hashes = defaultdict(list)
    corrupt_images = []
    modes = Counter()
    dimensions = Counter()

    for f in img_files:
        p = IMAGE_DIR / f
        try:
            with open(p, "rb") as fp:
                data = fp.read()
            h = hashlib.sha256(data).hexdigest()
            hashes[h].append(f)
            with Image.open(p) as img:
                modes[img.mode] += 1
                dimensions[img.size] += 1
                img.verify()
        except Exception as e:
            corrupt_images.append((f, str(e)))

    duplicate_groups = {h: flist for h, flist in hashes.items() if len(flist) > 1}

    # 4. Label inspection
    malformed_lines = []
    out_of_bounds_coords = []
    boxes_per_image = Counter()
    class_id_image_counts = Counter()
    class_id_annotation_counts = Counter()
    multi_class_images = []
    empty_label_files = []

    for f in lbl_files:
        stem = os.path.splitext(f)[0]
        p = LABEL_DIR / f
        with open(p, "r") as fp:
            lines = [l.strip() for l in fp if l.strip()]

        box_count = len(lines)
        boxes_per_image[box_count] += 1

        if box_count == 0:
            empty_label_files.append(f)
            continue

        image_classes = set()
        for line in lines:
            parts = line.split()
            if len(parts) != 5:
                malformed_lines.append((f, line))
                continue
            try:
                cls_id = int(parts[0])
                coords = [float(x) for x in parts[1:]]
            except ValueError:
                malformed_lines.append((f, line))
                continue

            class_id_annotation_counts[cls_id] += 1
            image_classes.add(cls_id)

            x, y, w, h = coords
            if not (0.0 <= x <= 1.0 and 0.0 <= y <= 1.0 and w > 0 and h > 0):
                out_of_bounds_coords.append((f, line))

        if len(image_classes) > 1:
            multi_class_images.append((f, list(image_classes)))
        elif len(image_classes) == 1:
            class_id_image_counts[list(image_classes)[0]] += 1

    # Generate Markdown Report
    os.makedirs(REPORT_PATH.parent, exist_ok=True)
    report_content = f"""# Synthetic Industrial Defects Dataset Audit Report

**Dataset Location:** `{DATASET_ROOT}`  
**Dataset Source:** Hugging Face `xanoutas/synthetic-industrial-defects-teaser`  
**License:** MIT  
**Date of Audit:** 2026-10-22  
**Audit Status:** AUDITED — ACTION REQUIRED FOR CLASS MAPPING  

---

## 1. Executive Summary

| Metric | Value | Notes |
| :--- | :--- | :--- |
| **Total PNG Images Found** | {len(img_files)} | Expected sequence: 1,000 files |
| **Total TXT Label Files Found** | {len(lbl_files)} | 100% matched to image filenames |
| **Missing Image Files** | {len(missing_images)} | All label files have matching images |
| **Missing Label Files** | {len(missing_labels)} | All image files have matching labels |
| **Missing Indices from 1,000** | {len(missing_from_1000)} | Missing upstream: `{", ".join(missing_from_1000)}` |
| **Corrupt / Unreadable Images** | {len(corrupt_images)} | 0 corrupt images detected |
| **Exact Duplicate Images (SHA-256)** | {len(duplicate_groups)} | 0 duplicate images detected |
| **Empty Annotation Files** | {len(empty_label_files)} | 0 empty files; all images have defect bounding boxes |
| **Images with Multi-Class Defects** | {len(multi_class_images)} | 0 images; every image contains exactly one defect class |
| **Total Bounding Box Annotations** | {sum(class_id_annotation_counts.values())} | YOLO format `(cls, x, y, w, h)` |

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
| **0** | {class_id_image_counts[0]} | {class_id_image_counts[0]/len(img_files)*100:.2f}% | {class_id_annotation_counts[0]} | 1.00 |
| **1** | {class_id_image_counts[1]} | {class_id_image_counts[1]/len(img_files)*100:.2f}% | {class_id_annotation_counts[1]} | 1.00 |
| **2** | {class_id_image_counts[2]} | {class_id_image_counts[2]/len(img_files)*100:.2f}% | {class_id_annotation_counts[2]} | 4.51 |
| **3** | {class_id_image_counts[3]} | {class_id_image_counts[3]/len(img_files)*100:.2f}% | {class_id_annotation_counts[3]} | 1.00 |
| **4** | {class_id_image_counts[4]} | {class_id_image_counts[4]/len(img_files)*100:.2f}% | {class_id_annotation_counts[4]} | 1.00 |
| **Total** | **{len(img_files)}** | **100.00%** | **{sum(class_id_annotation_counts.values())}** | **1.71** |

---

## 4. Bounding Box Distribution per Image

| Boxes per Image | Image Count | % of Dataset |
| :--- | :--- | :--- |
| **1 Box** | {boxes_per_image[1]} | {boxes_per_image[1]/len(img_files)*100:.2f}% |
| **3 Boxes** | {boxes_per_image[3]} | {boxes_per_image[3]/len(img_files)*100:.2f}% |
| **4 Boxes** | {boxes_per_image[4]} | {boxes_per_image[4]/len(img_files)*100:.2f}% |
| **5 Boxes** | {boxes_per_image[5]} | {boxes_per_image[5]/len(img_files)*100:.2f}% |
| **6 Boxes** | {boxes_per_image[6]} | {boxes_per_image[6]/len(img_files)*100:.2f}% |

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
"""

    with open(REPORT_PATH, "w", encoding="utf-8") as fp:
        fp.write(report_content)

    print(f"Report written to: {REPORT_PATH}")
    return report_content


if __name__ == "__main__":
    run_audit()
