# Inspectra ML Roadmap

**Project:** Inspectra — AI-Powered Product Quality Inspection  
**Owner:** ML teammate  
**Primary deliverable:** A reproducible image-inspection model and a clean inference interface that the main application can call.  
**Recommended first task:** Binary image classification (`good` vs `defective`) using a pretrained DINOv2 feature extractor and a trained classification head.

---

## 1. Goal and boundaries

Build one genuine learned capability that processes inspection images, persists reviewable predictions through the application team's integration, and can be evaluated on images not used for training or model selection.

### In scope

- Choose and document one visual-inspection dataset and one product setting.
- Audit labels, image formats, duplicates, class balance and dataset terms.
- Create leakage-resistant train/validation/test splits.
- Build a DINOv2-based classifier with a trained classification head.
- Evaluate the model on a held-out test set and document errors.
- Provide a stable Python inference interface, model weights and setup instructions.
- Return model identifier/version, predicted class, score semantics and inference time.
- Handle bad images, unsupported inputs and unavailable weights safely.
- Optionally expose a documented uncertainty heuristic for the review-priority feature.

### Out of scope

- Product/batch CRUD, authentication, permissions and the main web UI.
- Human review decisions, defect/action lifecycle, reinspection and batch hold/release.
- GenAI summaries.
- Automatic batch release or quality certification.
- Claims about defect categories not represented in the training labels.

**Important:** The model proposes an inspection result. It does not make the human decision, create a confirmed defect, close a corrective action, or release a batch.

---

## 2. Initial modelling decision

Unless the team has already selected another product family, begin with a **binary good/defective casting-image classifier**. The Buildathon brief identifies a casting-image dataset as a practical binary-classification route.

Before training, confirm:

1. Which product family the app will demonstrate.
2. Which dataset and specific release/subset will be used.
3. That its terms permit the team's intended use and demonstration.
4. That the labels actually support `good` and `defective`.
5. That the dataset's images reasonably represent the demo workflow.

Do not label a model as scratch/dent/crack classification unless the dataset genuinely provides those labels. Binary labels support only the binary task.

Record the dataset source, access date, licence/usage notes, label mapping and any filtering in `ml/README.md`.

---

## 3. Suggested ML folder layout

Adapt this to the repository's existing conventions. Do not move or recreate the web app just to match this example.

```text
ml/
├── README.md
├── requirements.txt             # Or the repository's existing dependency manager
├── configs/
│   └── casting_binary.yaml
├── data/
│   ├── README.md                # Dataset instructions; do not commit restricted data
│   └── splits/
│       ├── train.csv
│       ├── val.csv
│       └── test.csv
├── scripts/
│   ├── inspect_dataset.py
│   ├── create_splits.py
│   ├── train.py
│   ├── evaluate.py
│   └── predict_one.py
├── src/inspectra_ml/
│   ├── __init__.py
│   ├── dataset.py
│   ├── transforms.py
│   ├── model.py
│   ├── inference.py
│   └── schemas.py
├── artifacts/
│   └── README.md                # Store large weights separately if needed
├── reports/
│   ├── dataset_audit.md
│   ├── evaluation.md
│   └── error_analysis.md
└── tests/
    ├── test_preprocessing.py
    ├── test_inference.py
    └── test_output_schema.py
```

Do not commit datasets, secrets, large checkpoints or generated files blindly. Follow the team's repository and Git LFS/artifact-storage practices.

---

## 4. Work plan — complete each phase in order

### Phase ML-0 — Agree on the contract with the application teammate

Before implementation, coordinate these points with the main developer:

- The selected product family and label names.
- Where uploaded image bytes/files will be available to the inference code.
- The required Python version and dependency-management approach.
- Where model weights will live and how the app will configure that path.
- How model version and inference failures will be stored in the backend.
- Which component owns retrying inference and recording the result.

**Proposed interface:** a Python function such as `predict_image(image_path)` or `predict_image(image_bytes)`. Prefer a local Python interface first because the backend is also Python. Add a separate HTTP ML service only if deployment constraints actually require it.

**Exit criteria:** The input type, output schema, model path and error-handling contract are agreed with the main developer.

### Phase ML-1 — Dataset audit

Build `scripts/inspect_dataset.py` to report:

- Total image count and class counts.
- Missing, unreadable or corrupt files.
- Supported extensions and image dimensions.
- Class imbalance.
- Exact duplicate files using hashes.
- Potential near-duplicates using a documented method where feasible.
- Label mapping and samples excluded, including the reason.

Save a concise report to `reports/dataset_audit.md`.

Do not silently discard examples. Document exclusions and their counts. Do not use test images for preprocessing choices, threshold tuning or model selection.

**Exit criteria:** The dataset can be loaded reproducibly, the labels are understood, and the usage terms have been checked and documented.

### Phase ML-2 — Create leakage-resistant data splits

Create a reproducible split script and manifests containing at least image path/ID, label and split.

- Use separate training, validation and test sets.
- Fix and record the random seed.
- Preserve class representation where the dataset size allows it.
- Keep images from the same physical item, original source image, sequence or augmentation family in the same split whenever that information is available.
- Remove exact duplicates across splits; investigate likely near-duplicates.
- Never tune on the final test set.
- Keep an untouched test manifest so evaluation can be reproduced.

A split such as 70/15/15 may be used as a starting point, but choose it based on dataset size and grouping constraints; document the final ratios and counts.

**Exit criteria:** Train, validation and test manifests are versioned and checked for leakage.

### Phase ML-3 — Build a simple baseline first

Implement a reproducible baseline before adding complexity. A small classifier with frozen pretrained DINOv2 features and a trainable linear classification head is the recommended first approach.

1. Load a supported pretrained DINOv2 model.
2. Use its documented image preprocessing and expected input normalization.
3. Freeze the DINOv2 backbone for the first run.
4. Extract image features and train a small classification head on the training split.
5. Select hyperparameters using validation data only.
6. Save the best checkpoint, configuration and label mapping.
7. Ensure inference uses exactly the same preprocessing as training.

Do not train from scratch unless the dataset and compute budget justify it. Do not change preprocessing between training and inference without documenting and validating the change.

**Exit criteria:** One command trains the baseline reproducibly, and a saved checkpoint can load and predict an image.

### Phase ML-4 — Evaluate honestly

Run evaluation on the untouched test split and produce `reports/evaluation.md`.

Include:

- Dataset source/subset, final split counts and class counts.
- Model/backbone name, model version and training configuration.
- Preprocessing and label mapping.
- Confusion matrix.
- Precision, recall and F1 for each class, plus macro F1.
- Accuracy and ROC-AUC when appropriate and supported by the labels/scores.
- The number of test examples and any excluded cases.
- Representative false positives and false negatives, with image IDs or paths that teammates can inspect locally.
- Known weaknesses and cases where manual review is necessary.

Do not invent metrics or choose only favourable examples. Keep the final test set untouched until the model and selected settings are fixed. If the dataset is small, say so and interpret the results cautiously.

**Score terminology:** A softmax/sigmoid output is not automatically a calibrated probability. Call it a model score unless calibration has been measured and documented. Do not claim a fixed accuracy target that the project brief does not specify.

**Exit criteria:** Evaluation is reproducible, measured on held-out images and documented with failures as well as successes.

### Phase ML-5 — Build the inference module

Create a reusable inference interface. It must:

- Load the selected model/checkpoint once where practical, not reload it for every image.
- Accept a path or bytes using a clear, documented API.
- Validate and decode the image safely.
- Apply the exact model preprocessing.
- Run inference without gradients.
- Return the predicted class, raw model scores, model identifier/version and inference duration.
- Clearly report malformed, unsupported or unreadable images.
- Report missing weights or unavailable dependencies as errors, not as a `good` prediction.
- Avoid returning `defective` merely because inference failed.
- Avoid hardcoded or random predictions.

Suggested Python interface:

```python
from pathlib import Path
from typing import Union

ImageInput = Union[str, Path, bytes]


def predict_image(image: ImageInput) -> dict:
    """Return an inference result or raise a documented, typed error."""
    ...
```

Suggested successful result shape (adapt field names to the main application's agreed schema):

```json
{
  "status": "ok",
  "predicted_class": "defective",
  "scores": {
    "good": 0.18,
    "defective": 0.82
  },
  "score_type": "uncalibrated_model_score",
  "model_name": "dinov2-linear-head",
  "model_version": "1.0.0",
  "inference_ms": 42.7
}
```

The values above are illustrative schema examples only, not real predictions or measured latency. Calculate all returned values from actual inference. Document the exact interpretation of each score.

Suggested failure result at the application boundary:

```json
{
  "status": "failed",
  "error_code": "IMAGE_UNREADABLE",
  "message": "The uploaded image could not be decoded."
}
```

Never return a successful prediction payload on failure. The backend should persist a failed processing attempt and leave manual review/retry available.

**Exit criteria:** A teammate can load the trained checkpoint and invoke inference without needing the training notebook or UI code.

### Phase ML-6 — Optional uncertainty output for review prioritisation

The application team's proposed innovation is a review queue that prioritises uncertain predictions. If a useful output can be defined for the trained classifier:

- Document the exact uncertainty heuristic.
- One possible uncalibrated heuristic is `1 - max(class_scores)` for normalised class scores. Treat it as a ranking signal, not a probability of being wrong.
- Do not emit an uncertainty score if the score calculation is invalid or unavailable.
- Never call it calibrated confidence unless calibration has actually been evaluated.
- Validate whether higher-priority cases are genuinely more useful for review against held-out or historical labelled data.

The main application remains responsible for queue ordering and human decisions unless the team agrees otherwise.

**Exit criteria:** The output and its limitations are documented, and any claim about review prioritisation is backed by an actual evaluation.

### Phase ML-7 — Integration and acceptance tests

Work with the backend teammate to integrate the inference module with the image upload/inspection records.

The application/backend should persist:

- Input image/inspection reference.
- Predicted class or result.
- Model name and version.
- Raw scores and their documented meaning, where available.
- Inference duration.
- Processing status and error details, if failed.
- Creation timestamp.

Add tests for:

- A valid image producing a structurally valid result.
- Different supported image inputs, if the interface supports both paths and bytes.
- Corrupt and unsupported images.
- Missing checkpoint or unavailable model dependencies.
- Stable label mapping.
- Finite scores and valid output schema.
- Prediction consistency across repeat runs in the same configured environment, within reasonable numerical tolerance.
- Integration failures being stored as failed processing attempts rather than as no-defect outcomes.

Run the full relevant test suite. Do not make the inference result a human review decision or an automatic batch decision.

**Exit criteria:** The application can call the model, persist its result, display it beside the image and handle failure without losing the inspection.

### Phase ML-8 — Handover

Prepare the following handover package:

- `ml/README.md` with setup, dataset access, training, evaluation and inference commands.
- Dataset audit and licence/usage notes.
- Reproducible split manifests and random seed.
- Training configuration and label mapping.
- Checkpoint location and versioning instructions.
- Held-out test report and error analysis.
- Inference function/API contract and example success/error payloads.
- Automated tests and their actual results.
- Known limitations and uncompleted tasks.

**Exit criteria:** Another developer can reproduce evaluation, load the checkpoint and integrate inference using only the repository instructions and permitted model/data artifacts.

---

## 5. Definition of done

The ML task is done only when all applicable items are checked:

- [ ] One product setting and supported label schema are documented.
- [ ] Dataset access/usage terms have been checked and recorded.
- [ ] Dataset audit report exists.
- [ ] Train/validation/test splits are reproducible and leakage-checked.
- [ ] A genuine learned classifier has been trained or an equally valid learned method has been implemented.
- [ ] The checkpoint loads in a clean environment.
- [ ] Held-out evaluation and a confusion matrix are reported.
- [ ] Known failure cases and limitations are documented.
- [ ] An inference module is callable independently of the frontend.
- [ ] Success and failure results follow the agreed output schema.
- [ ] No dummy/random predictions or fabricated metrics exist.
- [ ] The application/backend integration has been tested, or the exact remaining integration work is documented.
- [ ] Setup, training, evaluation and inference instructions are complete.

A working notebook alone does not meet this definition of done.

---

## 6. Suggested commands

Adapt these commands to the repository's current tooling. Do not create a second environment-management system if the project already has one.

```bash
# From the repository root, inspect the existing environment and project conventions first.

# Example only: create an isolated Python environment if needed
python -m venv .venv-ml
source .venv-ml/bin/activate
python -m pip install --upgrade pip

# Install pinned ML dependencies using the project's chosen dependency file
python -m pip install -r ml/requirements.txt

# Run the dataset audit (adjust script arguments to the dataset layout)
python ml/scripts/inspect_dataset.py --config ml/configs/casting_binary.yaml

# Create reproducible manifests
python ml/scripts/create_splits.py --config ml/configs/casting_binary.yaml

# Train
python ml/scripts/train.py --config ml/configs/casting_binary.yaml

# Evaluate the selected checkpoint on the held-out test manifest
python ml/scripts/evaluate.py --config ml/configs/casting_binary.yaml

# Predict one local image
python ml/scripts/predict_one.py --image /path/to/example.jpg

# Run the ML tests using the repository's configured test runner
python -m pytest ml/tests -q
```

The commands are a proposed layout. The teammate must make them match the actual repository and verify them before putting them in the final README.

---

## 7. Final report to the team

At handover, report:

1. Dataset name, source/subset and usage/licence notes.
2. Number of images per split and per class.
3. Model name, version and training approach.
4. Held-out results and the confusion matrix.
5. Representative false positives/false negatives and known limitations.
6. Checkpoint location and how it is loaded.
7. Exact inference interface and output schema.
8. Exact commands run and actual test results.
9. What the backend teammate needs to do to integrate it.
10. Any blockers; do not present incomplete pieces as finished.

**Start with ML-0. Confirm the integration contract and inspect the available dataset before training. Work through the phases in order and report blockers early.**
