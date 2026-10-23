# Inspectra ML Subsystem

This directory contains the machine learning components for **Inspectra — AI-Powered Product Quality Inspection & Defect Tracking System** (Buildathon 2.0, Problem Statement 1).

## Scope & Architectural Principles

- **Objective:** Train and serve an EfficientNet-B0 binary image classification model (`good` vs `defective`) using ImageNet-1k pretrained features with a tailored classification head to inspect industrial casting components.
- **Contract Boundary:** The ML model proposes an inspection observation (`predicted_class`, `scores`, `confidence_score`, `processing_duration_ms`). It does **not** make human decisions, create final defect records, or release production batches.
- **Decoupled Architecture:** ML training, evaluation, and data pipelines are completely decoupled from the Flask backend and React frontend. The application consumes inference through a typed service interface (`backend.services.ml_service`).

---

## Directory Structure

```text
ml/
├── README.md               # This file
├── configs/
│   ├── casting_binary.yaml # Binary EfficientNet-B0 dataset & training configuration
│   └── multiclass_defect.yaml # Multiclass classification config
├── data/
│   ├── README.md           # Dataset acquisition, licensing & storage guide
│   ├── splits/             # Binary versioned, leakage-resistant split manifests (.csv)
│   └── splits_multiclass/  # Multiclass split manifests (.csv)
├── scripts/
│   ├── inspect_dataset.py  # Phase ML-1: Dataset audit tool
│   ├── create_splits.py    # Phase ML-2: Leakage-safe split generator
│   ├── train.py            # Phase ML-3: Baseline training pipeline
│   ├── evaluate.py         # Phase ML-4: Held-out evaluation
│   ├── train_multiclass.py # Multiclass defect classifier training
│   └── evaluate_multiclass.py # Multiclass defect evaluation
├── src/
│   └── inspectra_ml/       # Core reusable Python package
│       ├── __init__.py
│       ├── dataset.py
│       ├── transforms.py
│       ├── model.py        # EfficientNet-B0 architecture
│       └── inference.py    # Runtime inference & checkpoint loader
├── artifacts/              # Trained weights & evaluation metrics
│   ├── best_model.pth      # EfficientNet-B0 checkpoint (eval F1: 0.9669)
│   ├── training_history.json
│   └── test_predictions.json
├── reports/
│   ├── dataset_audit.md    # Phase ML-1 dataset audit report
│   ├── splits_summary.md   # Phase ML-2 leakage-safe splits report
│   ├── baseline_training.md# Phase ML-3 baseline training report
│   └── heldout_evaluation.md # Phase ML-4 held-out evaluation report
└── tests/                  # Automated pytest test suites (50+ tests)
```

---

## Reproducible Pipeline Commands

### Phase ML-1: Dataset Audit Execution
Inspects image integrity, format support, resolution, exact duplicate hashes, and class distribution:
```bash
python ml/scripts/inspect_dataset.py --config ml/configs/casting_binary.yaml
```

### Phase ML-2: Leakage-Safe Data Splitting
Creates stratified, leakage-resistant split manifests (CSV + JSON) where all exact duplicate image groups are locked to the same split:
```bash
python ml/scripts/create_splits.py --train-ratio 0.70 --val-ratio 0.15 --test-ratio 0.15 --seed 42
```

### Phase ML-3: Model Training
Trains the EfficientNet-B0 classifier with ImageNet-1k pretrained features on `train.csv`, using `val.csv` for checkpoint and threshold selection:
```bash
python ml/scripts/train.py --epochs 3 --batch-size 64 --lr 0.001 --seed 42
```

### Phase ML-4: Held-Out Test Set Evaluation
Executes honest evaluation on the untouched `test.csv` split using the frozen validation threshold (`0.38`):
```bash
python ml/scripts/evaluate.py --threshold 0.38
```
Outputs generated:
- `ml/reports/heldout_evaluation.md` (full evaluation report with confusion matrix, accuracy 96.15%, F1 0.9669)
- `ml/artifacts/test_predictions.json` (per-sample prediction details)

---

## Runtime Inference & Failure Recovery

The Flask application integrates ML inference via `backend.services.ml_service.process_inspection_image_ml`:
1. **Loaded Checkpoint:** Automatically checks `ml/artifacts/best_model.pth`.
2. **Schema Output:** Stores `predicted_class`, `confidence_score`, `raw_scores` (`good` vs `defective`), `model_name`, `model_version`, and `processing_duration_ms` in `MLResult`.
3. **Resilience & Safe Recovery:** If checkpoint weights are unavailable, the image is corrupt, or an inference exception occurs:
   - The inspection record and uploaded image file are strictly preserved.
   - `Inspection.status` is set to `processing_failed` with the error captured in audit logs.
   - The user or supervisor can manually review, re-analyze, or attach manual observations without losing evidence.

---

## Running Tests

Run the full ML test suite:
```bash
.venv/bin/pytest ml/tests -v
```
