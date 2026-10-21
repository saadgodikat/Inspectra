# Inspectra ML Subsystem

This directory contains the machine learning components for **Inspectra — AI-Powered Product Quality Inspection & Defect Tracking System** (Buildathon 2.0, Problem Statement 1).

## Scope & Architectural Principles

- **Objective:** Train a binary image classification model (`good` vs `defective`) using a pretrained DINOv2 feature extractor with a trained classification head to inspect casting manufacturing components.
- **Contract Boundary:** The ML model proposes an inspection observation (`predicted_class`, `scores`, `uncertainty_score`, `inference_ms`). It does **not** make human decisions, create final defect records, or release production batches.
- **Decoupled Architecture:** ML training, evaluation, and data pipelines are completely decoupled from the Flask backend and React frontend.

---

## Directory Structure

```text
ml/
├── README.md               # This file
├── configs/
│   └── casting_binary.yaml # Dataset & training configuration
├── data/
│   ├── README.md           # Dataset acquisition, licensing & storage guide
│   └── splits/             # Versioned, leakage-resistant split manifests (.csv)
├── scripts/
│   ├── inspect_dataset.py  # Phase ML-1: Dataset audit tool
│   ├── create_splits.py    # Phase ML-2: Data splitting (future)
│   ├── train.py            # Phase ML-3: DINOv2 baseline training (future)
│   ├── evaluate.py         # Phase ML-4: Held-out evaluation (future)
│   └── predict_one.py      # Phase ML-5: Local sample prediction CLI (future)
├── src/
│   └── inspectra_ml/       # Core reusable Python package
│       ├── __init__.py
│       ├── dataset.py
│       ├── transforms.py
│       ├── model.py
│       └── inference.py
├── artifacts/              # Trained weights & checkpoints (git-ignored)
├── reports/
│   ├── dataset_audit.md    # Phase ML-1 dataset audit report
│   └── evaluation.md       # Phase ML-4 model evaluation report (future)
└── tests/
    ├── conftest.py
    ├── test_inspect_dataset.py # Automated tests for dataset auditing
    └── test_create_splits.py   # Automated tests for leakage-safe splitting
```

---

## Phase ML-1: Dataset Audit Execution

Before training or splitting, run the dataset audit to inspect image integrity, format support, resolution, exact duplicate hashes, and class distribution:

```bash
# Run audit pointing to your dataset directory:
python ml/scripts/inspect_dataset.py --data-dir ml/data/raw/casting_data

# Or run with the default configuration:
python ml/scripts/inspect_dataset.py --config ml/configs/casting_binary.yaml

# Specify custom report output:
python ml/scripts/inspect_dataset.py --data-dir /path/to/dataset --output ml/reports/dataset_audit.md
```

---

## Phase ML-2: Leakage-Safe Data Splitting

Create stratified, leakage-resistant split manifests (CSV + JSON) where all exact duplicate image groups are locked to the same split:

```bash
# Run splitting with default 70/15/15 ratio and seed 42:
python ml/scripts/create_splits.py --data-dir ml/data/raw/casting_data --output-dir ml/data/splits

# Or specify custom parameters:
python ml/scripts/create_splits.py --train-ratio 0.70 --val-ratio 0.15 --test-ratio 0.15 --seed 42
```

---

## Phase ML-3: Baseline Defect Classifier Training

Train the EfficientNet-B0 binary classifier using ImageNet-1k pretrained features on `train.csv`, using `val.csv` for checkpoint and threshold selection:

```bash
python ml/scripts/train.py --epochs 3 --batch-size 64 --lr 0.001 --seed 42
```

Outputs generated:
- `ml/artifacts/best_model.pth` (best model checkpoint based on validation F1)
- `ml/artifacts/training_history.json` (epoch losses, metrics, and optimal threshold)
- `ml/reports/baseline_training.md` (training progress and validation metrics)

---

## Phase ML-4: Held-Out Test Set Evaluation

Run leakage-verified, honest evaluation on the untouched `test.csv` split using the frozen validation threshold (`0.38`):

```bash
python ml/scripts/evaluate.py --threshold 0.38
```

Outputs generated:
- `ml/reports/heldout_evaluation.md` (full evaluation report with confusion matrix and error analysis)
- `ml/artifacts/test_predictions.json` (per-sample prediction details)

---

## Running Tests

Run the full ML test suite (30 automated tests):

```bash
pytest ml/tests -v
```
