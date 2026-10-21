# Inspectra Dataset Guide & Licensing Audit

## 1. Selected Product Family & Benchmark Dataset

- **Product Setting:** Manufacturing quality inspection of cast metal components (submersible pump impeller castings).
- **Recommended Benchmark Dataset:** *Casting Product Image Data for Quality Inspection*
- **Primary Source URL:** [Kaggle Dataset: Real-life industrial dataset of casting](https://www.kaggle.com/datasets/ravirajsinh45/real-life-industrial-dataset-of-casting)
- **Author Reference:** Raviraj Sinh (`ravirajsinh45`)

---

## 2. Licensing and Usage Terms

Before training or deploying any model on this dataset, verify the following:

| Item | Details |
| :--- | :--- |
| **Licence Type** | Released under **CC0: Public Domain** |
| **Permitted Use** | Hackathon, academic research, prototyping, and demonstration purposes without copyright restrictions. |
| **Commercial Restrictions** | None under CC0, though proper dataset attribution is standard professional practice. |
| **Data Privacy / PII** | Images depict inanimate manufactured metal castings under industrial top-down lighting; no human subjects, faces, or personally identifiable information (PII) exist in the data. |

---

## 3. Storage and Git Policy

> [!IMPORTANT]
> **DO NOT commit raw images, zip archives, or model checkpoints to Git.**
> The `.gitignore` file is configured to strictly ignore `ml/data/raw/` and `ml/artifacts/*.pth` to keep the repository lean and avoid accidental bloat.

---

## 4. Manual Download and Extraction Instructions

Follow these steps to acquire and place the dataset locally:

### Option A: Manual Browser Download (Recommended)

1. Open your browser and navigate to:
   `https://www.kaggle.com/datasets/ravirajsinh45/real-life-industrial-dataset-of-casting`
2. Click **Download** (requires a free Kaggle account) to obtain the archive (typically `archive.zip` or `real-life-industrial-dataset-of-casting.zip`, ~100MB).
3. Create the raw data directory in your Inspectra repository:
   ```powershell
   New-Item -ItemType Directory -Force -Path "ml\data\raw"
   ```
4. Extract the zip file into `ml\data\raw`:
   ```powershell
   Expand-Archive -Path "$HOME\Downloads\archive.zip" -DestinationPath "ml\data\raw\casting_data" -Force
   ```

### Option B: Kaggle CLI (If configured)

If you have the `kaggle` CLI authenticated on your machine:
```powershell
New-Item -ItemType Directory -Force -Path "ml\data\raw\casting_data"
kaggle datasets download -d ravirajsinh45/real-life-industrial-dataset-of-casting -p ml/data/raw/casting_data --unzip
```

---

## 5. Expected Local Folder Structure

Depending on how Kaggle packages the zip archive, the extracted files will follow either a nested split structure or a flat structure. The Inspectra audit tool (`inspect_dataset.py`) recursively scans directories and correctly identifies classes in either structure:

### Nested Structure (Kaggle Default):
```text
ml/data/raw/casting_data/
â”œâ”€â”€ train/
â”‚   â”œâ”€â”€ def_front/         # Defective castings (maps to 'defective')
â”‚   â”‚   â”œâ”€â”€ cast_def_0_*.jpeg
â”‚   â””â”€â”€ ok_front/          # Acceptable castings (maps to 'good')
â”‚       â”œâ”€â”€ cast_ok_0_*.jpeg
â””â”€â”€ test/
    â”œâ”€â”€ def_front/
    â””â”€â”€ ok_front/
```

### Flat Structure (Alternative):
```text
ml/data/raw/casting_data/
â”œâ”€â”€ def_front/             # Defective castings (maps to 'defective')
â”‚   â”œâ”€â”€ cast_def_*.jpeg
â””â”€â”€ ok_front/              # Acceptable castings (maps to 'good')
    â”œâ”€â”€ cast_ok_*.jpeg
```

---

## 6. Label Mapping & Semantics

| Original Directory / File Token | Canonical Inspectra Label | Semantic Quality Decision |
| :--- | :--- | :--- |
| `ok_front` / `ok` / `good` | `good` | Component has no disqualifying surface defects; passes inspection. |
| `def_front` / `def` / `defective` | `defective` | Surface or structural defect observed (pinholes, cracks, burrs, blowholes). |

> [!CAUTION]
> Do not fabricate fine-grained defect sub-categories (e.g. `scratch`, `dent`, `crack`) unless the source dataset provides validated annotations for those specific labels. The casting benchmark provides binary `good` vs `defective` ground truth.

---

## 7. How to Run the Dataset Audit

Once the dataset is extracted locally, execute the audit script using Windows PowerShell:

### Default Path (`ml/data/raw/casting_data`):
```powershell
python ml/scripts/inspect_dataset.py
```

### Custom Dataset Directory:
```powershell
python ml/scripts/inspect_dataset.py --data-dir "C:\path\to\your\custom_casting_data" --output "ml\reports\dataset_audit.md"
```

### Using Configuration File:
```powershell
python ml/scripts/inspect_dataset.py --config ml/configs/casting_binary.yaml
```

The script will scan all files, verify image integrity, check image formats and dimensions, detect exact duplicate file hashes, calculate class balance, log exclusions, and write the full report to `ml/reports/dataset_audit.md`.
