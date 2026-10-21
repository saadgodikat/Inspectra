"""ML Service integration for Inspectra backend (Phase ML-6).

Provides robust, decoupled ML prediction invocation for uploaded inspection images:
- Ensures ml/src is discoverable on sys.path regardless of working directory.
- Reuses predict_image() from inspectra_ml.inference without duplicating ML logic.
- Resolves server-controlled file path using file_service.get_image_file_path().
- Updates InspectionImage processing_state and failure_reason safely.
- Persists MLResult records with 'success' or 'failed' status.
- Preserves transaction integrity using per-image nested transactions.
"""

import sys
import os
import logging
from pathlib import Path
from typing import Optional, Dict, Any

from flask import current_app
from backend.extensions import db
from backend.models.inspection_image import InspectionImage, ImageProcessingState
from backend.models.ml_result import MLResult, MLResultStatus
from backend.services.file_service import get_image_file_path

# Ensure ml/src is on sys.path regardless of execution working directory
REPO_ROOT = Path(__file__).resolve().parents[2]
ML_SRC = REPO_ROOT / "ml" / "src"
if ML_SRC.is_dir() and str(ML_SRC) not in sys.path:
    sys.path.insert(0, str(ML_SRC))

try:
    from inspectra_ml.inference import predict_image
except ImportError:
    # Graceful fallback if heavy ML dependencies are not present in the runtime
    predict_image = None

logger = logging.getLogger(__name__)

DEFAULT_MODEL_NAME = "efficientnet_b0_casting_binary"
DEFAULT_MODEL_VERSION = "v1.0.0"


def _sanitize_error_message(raw_msg: Optional[str]) -> str:
    """Sanitize error messages to ensure internal file paths and traces are never exposed."""
    if not raw_msg:
        return "Inference failed."
    # Disallow internal filesystem paths, tracebacks, or secret leaks
    if "\\" in raw_msg or "/" in raw_msg or "Traceback" in raw_msg or "File " in raw_msg:
        return "Model inference failed during processing."
    return raw_msg.strip()


def process_inspection_image_ml(
    image_record: InspectionImage,
    checkpoint_path: Optional[str] = None,
) -> MLResult:
    """Run ML inference on a stored inspection image and persist the MLResult.

    Args:
        image_record: Saved InspectionImage DB record.
        checkpoint_path: Optional custom path to model checkpoint. Defaults to app config
                         or model default.

    Returns:
        Persisted MLResult instance.
    """
    inspection_id = image_record.inspection_id
    image_id = image_record.id

    model_name = DEFAULT_MODEL_NAME
    model_version = DEFAULT_MODEL_VERSION
    if current_app:
        model_name = current_app.config.get("ML_MODEL_NAME", DEFAULT_MODEL_NAME)
        model_version = current_app.config.get("ML_MODEL_VERSION", DEFAULT_MODEL_VERSION)
        if checkpoint_path is None:
            checkpoint_path = current_app.config.get("ML_CHECKPOINT_PATH")

    # 1. Resolve secure filesystem path
    file_path = get_image_file_path(image_record)
    if not file_path or not os.path.isfile(file_path):
        logger.warning(f"Image file missing on disk for InspectionImage id={image_id}")
        image_record.processing_state = ImageProcessingState.FAILED.value
        image_record.failure_reason = "Image file missing or inaccessible on disk."

        ml_result = MLResult(
            inspection_id=inspection_id,
            image_id=image_id,
            predicted_class=None,
            model_name=model_name,
            model_version=model_version,
            raw_scores=None,
            processing_duration_ms=None,
            status=MLResultStatus.FAILED.value,
            error_details="Image file missing or inaccessible on disk.",
        )
        db.session.add(ml_result)
        db.session.flush()
        return ml_result

    # 2. Check if inference function is importable
    if predict_image is None:
        logger.error("ML inference module inspectra_ml is unavailable.")
        image_record.processing_state = ImageProcessingState.FAILED.value
        image_record.failure_reason = "ML inference runtime is not available."

        ml_result = MLResult(
            inspection_id=inspection_id,
            image_id=image_id,
            predicted_class=None,
            model_name=model_name,
            model_version=model_version,
            raw_scores=None,
            processing_duration_ms=None,
            status=MLResultStatus.FAILED.value,
            error_details="ML inference runtime is not available.",
        )
        db.session.add(ml_result)
        db.session.flush()
        return ml_result

    # 3. Mark state as processing
    image_record.processing_state = ImageProcessingState.PROCESSING.value
    db.session.flush()

    # 4. Invoke inference safely
    try:
        kwargs: Dict[str, Any] = {}
        if checkpoint_path is not None:
            kwargs["checkpoint_path"] = checkpoint_path
        pred_dict = predict_image(file_path, **kwargs)
    except Exception as exc:
        logger.exception(f"Unexpected exception during predict_image for image id={image_id}: {exc}")
        pred_dict = {
            "status": "failed",
            "predicted_class": None,
            "scores": None,
            "model_name": model_name,
            "model_version": model_version,
            "processing_duration_ms": None,
            "error_details": "An unexpected error occurred during model inference.",
        }

    # 5. Map prediction result to MLResult and update InspectionImage
    pred_status = pred_dict.get("status")
    duration = pred_dict.get("processing_duration_ms")
    duration_int = int(round(duration)) if duration is not None else None

    if pred_status == "success":
        image_record.processing_state = ImageProcessingState.PROCESSED.value
        image_record.failure_reason = None
        ml_status = MLResultStatus.SUCCESS.value
        error_details = None
    else:
        image_record.processing_state = ImageProcessingState.FAILED.value
        error_details = _sanitize_error_message(pred_dict.get("error_details"))
        image_record.failure_reason = error_details
        ml_status = MLResultStatus.FAILED.value

    ml_result = MLResult(
        inspection_id=inspection_id,
        image_id=image_id,
        predicted_class=pred_dict.get("predicted_class"),
        model_name=pred_dict.get("model_name") or model_name,
        model_version=pred_dict.get("model_version") or model_version,
        raw_scores=pred_dict.get("scores"),
        processing_duration_ms=duration_int,
        status=ml_status,
        error_details=error_details,
    )
    db.session.add(ml_result)
    db.session.flush()

    return ml_result
