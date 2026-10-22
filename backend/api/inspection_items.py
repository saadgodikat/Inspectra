"""Inspection Items API — bulk upload, ML analysis, item listing, and override."""

import re

from flask import Blueprint, jsonify, request

from backend.extensions import db
from backend.models.inspection import Inspection, InspectionStatus
from backend.models.inspection_item import InspectionItem, ItemStatus
from backend.models.ml_result import MLResult, MLResultStatus
from backend.models.inspection_image import InspectionImage, ImageProcessingState
from backend.middleware.permissions import require_permission
from backend.middleware.errors import NotFoundError, ValidationError
from backend.services.audit_service import log_audit_event
from backend.services.file_service import save_inspection_image, get_image_file_path
from backend.services.ml_service import run_efficientnet

items_bp = Blueprint("inspection_items", __name__, url_prefix="/api/inspections")

VALID_OVERRIDE_DECISIONS = {"good", "defective"}


def _extract_item_number(filename: str):
    """Extract the leading or embedded integer from a filename.

    Examples:
        '059.jpg'          -> 59
        'casting_059.png'  -> 59
        'item-3.webp'      -> 3
        '3.jpg'            -> 3
    Returns None if no integer found.
    """
    stem = filename.rsplit(".", 1)[0]  # strip extension
    numbers = re.findall(r"\d+", stem)
    if not numbers:
        return None
    return int(numbers[-1])  # use last number found in stem


# ------------------------------------------------------------------ #
# GET /api/inspections/<id>/items                                     #
# ------------------------------------------------------------------ #

@items_bp.route("/<int:inspection_id>/items", methods=["GET"])
@require_permission("inspection.view")
def list_items(inspection_id, current_user):
    """Return all allocated item slots for an inspection with their status and ML results."""
    inspection = db.session.get(Inspection, inspection_id)
    if not inspection:
        raise NotFoundError("Inspection not found")

    items = (
        InspectionItem.query
        .filter_by(inspection_id=inspection_id)
        .order_by(InspectionItem.item_number.asc())
        .all()
    )

    total = len(items)
    uploaded = sum(1 for i in items if i.status in (ItemStatus.UPLOADED, ItemStatus.ANALYZED))
    analyzed = sum(1 for i in items if i.status == ItemStatus.ANALYZED)
    good = sum(1 for i in items if i.effective_decision() == "good")
    defective = sum(1 for i in items if i.effective_decision() == "defective")
    pending_upload = sum(1 for i in items if i.status == ItemStatus.PENDING_UPLOAD)

    return jsonify({
        "inspection_id": inspection_id,
        "summary": {
            "total": total,
            "uploaded": uploaded,
            "analyzed": analyzed,
            "pending_upload": pending_upload,
            "good": good,
            "defective": defective,
        },
        "items": [i.to_dict() for i in items],
    }), 200


# ------------------------------------------------------------------ #
# POST /api/inspections/<id>/bulk-upload                             #
# ------------------------------------------------------------------ #

@items_bp.route("/<int:inspection_id>/bulk-upload", methods=["POST"])
@require_permission("inspection.upload_image")
def bulk_upload(inspection_id, current_user):
    """Bulk upload images for an inspection run.

    Accepts multipart/form-data with field 'images' (multiple files).
    Each filename must contain an integer matching an allocated item number.
    Unmatched filenames are returned as errors with a rename hint.
    """
    inspection = db.session.get(Inspection, inspection_id)
    if not inspection:
        raise NotFoundError("Inspection not found")

    uploaded_files = request.files.getlist("images")
    valid_files = [f for f in uploaded_files if f and f.filename]

    if not valid_files:
        raise ValidationError("No image files provided")

    # Build lookup: item_number -> InspectionItem
    all_items = InspectionItem.query.filter_by(inspection_id=inspection_id).all()
    item_map = {item.item_number: item for item in all_items}

    if not item_map:
        raise ValidationError(
            "No item slots allocated for this inspection. "
            "Ensure the inspection was created with a batch that has a quantity set."
        )

    succeeded = []
    errors = []

    for f in valid_files:
        filename = f.filename or ""
        item_number = _extract_item_number(filename)

        if item_number is None:
            errors.append({
                "filename": filename,
                "error": "No item number found in filename. Rename to match item number (e.g. '059.jpg' or 'casting_059.png').",
            })
            continue

        if item_number not in item_map:
            errors.append({
                "filename": filename,
                "error": f"Item number {item_number} is not allocated for this inspection (valid range: 1–{max(item_map.keys())}). Rename to match item number.",
            })
            continue

        item = item_map[item_number]
        if any(result["item_number"] == item_number for result in succeeded):
            errors.append({
                "filename": filename,
                "error": f"More than one image was selected for item {item_number}. Upload one image per item.",
            })
            continue

        # Save image via existing file service
        image_record, error_dict = save_inspection_image(
            inspection_id=inspection_id,
            user_id=current_user.id,
            file_storage=f,
            sample_type="item",
        )

        if error_dict:
            errors.append({"filename": filename, "error": error_dict["error"]})
            continue

        # Link image to item slot
        item.image_id = image_record.id
        item.status = ItemStatus.UPLOADED
        item.ml_result_id = None
        item.override_decision = None
        item.override_comment = None
        item.override_by_id = None

        succeeded.append({
            "item_number": item_number,
            "image_id": image_record.id,
            "filename": filename,
        })

    if succeeded:
        # Transition inspection status if still pending
        if inspection.status == InspectionStatus.PENDING_UPLOAD.value:
            inspection.status = InspectionStatus.PENDING_REVIEW.value

        log_audit_event(
            actor_id=current_user.id,
            action="inspection.bulk_upload",
            entity_type="inspection",
            entity_id=inspection_id,
            details={"uploaded": len(succeeded), "errors": len(errors)},
        )
        db.session.commit()

    return jsonify({
        "message": f"{len(succeeded)} image(s) uploaded, {len(errors)} error(s).",
        "succeeded": succeeded,
        "errors": errors,
        "total_uploaded": len(succeeded),
        "total_errors": len(errors),
    }), 200 if succeeded else 422


# ------------------------------------------------------------------ #
# POST /api/inspections/<id>/run-analysis                            #
# ------------------------------------------------------------------ #

@items_bp.route("/<int:inspection_id>/run-analysis", methods=["POST"])
@require_permission("inspection.upload_image")
def run_analysis(inspection_id, current_user):
    """Trigger ML analysis on all uploaded items for this inspection.

    Runs EfficientNet-B0 on each item that has an image and hasn't been analyzed yet.
    Returns a summary of results.
    """
    inspection = db.session.get(Inspection, inspection_id)
    if not inspection:
        raise NotFoundError("Inspection not found")

    items_to_analyze = (
        InspectionItem.query
        .filter_by(inspection_id=inspection_id, status=ItemStatus.UPLOADED)
        .all()
    )

    failed = 0

    for item in items_to_analyze:
        if not item.image_id:
            failed += 1
            continue

        image = db.session.get(InspectionImage, item.image_id)
        if not image:
            failed += 1
            continue

        file_path = get_image_file_path(image)
        if not file_path:
            image.processing_state = ImageProcessingState.FAILED.value
            image.failure_reason = "Uploaded image file is missing from storage."
            failed += 1
            continue

        image.processing_state = ImageProcessingState.PROCESSING.value
        try:
            result = run_efficientnet(file_path)
        except Exception as e:
            image.processing_state = ImageProcessingState.FAILED.value
            image.failure_reason = str(e)
            failed += 1
            continue

        ml_record = MLResult(
            inspection_id=inspection_id,
            image_id=item.image_id,
            predicted_class=result["predicted_class"],
            model_name=result["model_name"],
            model_version=result["model_version"],
            raw_scores=result["scores"],
            processing_duration_ms=result["duration_ms"],
            status=MLResultStatus.SUCCESS.value,
        )
        db.session.add(ml_record)
        db.session.flush()

        item.ml_result_id = ml_record.id
        item.status = ItemStatus.ANALYZED
        image.processing_state = ImageProcessingState.PROCESSED.value

    # Transition inspection to processing_failed only if everything failed
    if items_to_analyze and failed < len(items_to_analyze):
        inspection.status = InspectionStatus.PENDING_REVIEW.value

    if items_to_analyze:
        log_audit_event(
            actor_id=current_user.id,
            action="inspection.run_analysis",
            entity_type="inspection",
            entity_id=inspection_id,
            details={"attempted": len(items_to_analyze), "failed": failed},
        )
    db.session.commit()

    all_items = InspectionItem.query.filter_by(inspection_id=inspection_id).all()
    pending_upload = sum(1 for i in all_items if i.status == ItemStatus.PENDING_UPLOAD)
    analyzed = sum(1 for i in all_items if i.status == ItemStatus.ANALYZED)
    good = sum(1 for i in all_items if i.effective_decision() == "good")
    defective = sum(1 for i in all_items if i.effective_decision() == "defective")

    return jsonify({
        "message": f"Analysis complete. {analyzed} item(s) analyzed; {failed} failure(s) in this run.",
        "analyzed": analyzed,
        "good": good,
        "defective": defective,
        "failed": failed,
        "pending_upload": pending_upload,
        "total": len(all_items),
    }), 200


# ------------------------------------------------------------------ #
# PATCH /api/inspections/<id>/items/<item_number>/override           #
# ------------------------------------------------------------------ #

@items_bp.route("/<int:inspection_id>/items/<int:item_number>/override", methods=["PATCH"])
@require_permission("inspection_item.override")
def override_item(inspection_id, item_number, current_user):
    """Override the ML decision for a single item.

    Body: { decision: "good" | "defective", comment?: string }
    """
    inspection = db.session.get(Inspection, inspection_id)
    if not inspection:
        raise NotFoundError("Inspection not found")

    item = InspectionItem.query.filter_by(
        inspection_id=inspection_id, item_number=item_number
    ).first()
    if not item:
        raise NotFoundError(f"Item {item_number} not found in this inspection")

    if item.ml_result is None or item.status != ItemStatus.ANALYZED:
        raise ValidationError("Only analyzed items can be overridden")

    data = request.get_json(silent=True) or {}
    raw_decision = data.get("decision")
    decision = raw_decision.strip().lower() if isinstance(raw_decision, str) else ""
    raw_comment = data.get("comment")
    if raw_comment is not None and not isinstance(raw_comment, str):
        raise ValidationError("comment must be a string")
    comment = raw_comment.strip() or None if raw_comment else None

    if decision not in VALID_OVERRIDE_DECISIONS:
        raise ValidationError(f"decision must be one of: {', '.join(sorted(VALID_OVERRIDE_DECISIONS))}")

    item.override_decision = decision
    item.override_comment = comment
    item.override_by_id = current_user.id

    log_audit_event(
        actor_id=current_user.id,
        action="inspection_item.override",
        entity_type="inspection_item",
        entity_id=item.id,
        details={
            "inspection_id": inspection_id,
            "item_number": item_number,
            "override_decision": decision,
            "ml_decision": item.ml_result.predicted_class if item.ml_result else None,
        },
    )
    db.session.commit()

    return jsonify({
        "message": f"Item {item_number} overridden to '{decision}'.",
        "item": item.to_dict(),
    }), 200
