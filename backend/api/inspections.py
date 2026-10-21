"""Inspections API endpoints — intake, image uploads, secure evidence delivery, and listing."""

from datetime import datetime, timezone, date
from flask import Blueprint, jsonify, request, send_file, current_app
from sqlalchemy import or_

from backend.extensions import db
from backend.models.inspection import Inspection, InspectionStatus, SampleType
from backend.models.inspection_image import InspectionImage
from backend.models.product import Product
from backend.models.batch import Batch, BatchStatus
from backend.middleware.permissions import require_permission
from backend.middleware.errors import NotFoundError, ValidationError, ForbiddenError
from backend.services.audit_service import log_audit_event
from backend.services.file_service import save_inspection_image, get_image_file_path
from backend.services.ml_service import process_inspection_image_ml

inspections_bp = Blueprint("inspections", __name__, url_prefix="/api/inspections")

VALID_SAMPLE_TYPES = {s.value for s in SampleType}
VALID_INSPECTION_STATUSES = {s.value for s in InspectionStatus}

# Editable statuses for draft corrections
EDITABLE_STATUSES = {
    InspectionStatus.PENDING_UPLOAD.value,
    InspectionStatus.NEEDS_MORE_EVIDENCE.value,
    InspectionStatus.PROCESSING_FAILED.value,
}


@inspections_bp.route("", methods=["GET"])
@require_permission("inspection.view")
def list_inspections(current_user):
    """List inspections with filtering, search, and pagination.

    Query params:
      - product_id: integer
      - batch_id: integer
      - inspector_id: integer
      - status: string
      - sample_type: string
      - search: string (matches sample_reference or observations)
      - date_from, date_to: YYYY-MM-DD
      - page: integer (default 1)
      - per_page: integer (default 20, max 100)
    """
    product_id = request.args.get("product_id", type=int)
    batch_id = request.args.get("batch_id", type=int)
    inspector_id = request.args.get("inspector_id", type=int)
    status = request.args.get("status", "").strip().lower()
    sample_type = request.args.get("sample_type", "").strip().lower()
    search = request.args.get("search", "").strip()
    date_from = request.args.get("date_from", "").strip()
    date_to = request.args.get("date_to", "").strip()

    page = max(1, request.args.get("page", 1, type=int))
    per_page = min(100, max(1, request.args.get("per_page", 20, type=int)))

    query = Inspection.query

    if product_id:
        query = query.filter_by(product_id=product_id)

    if batch_id:
        query = query.filter_by(batch_id=batch_id)

    if inspector_id:
        query = query.filter_by(inspector_id=inspector_id)

    if status and status != "all":
        query = query.filter_by(status=status)

    if sample_type and sample_type != "all":
        query = query.filter_by(sample_type=sample_type)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Inspection.sample_reference.ilike(search_pattern),
                Inspection.observations.ilike(search_pattern),
            )
        )

    if date_from:
        try:
            d_from = date.fromisoformat(date_from)
            query = query.filter(Inspection.inspection_timestamp >= datetime.combine(d_from, datetime.min.time(), tzinfo=timezone.utc))
        except ValueError:
            raise ValidationError("date_from must be in YYYY-MM-DD format")

    if date_to:
        try:
            d_to = date.fromisoformat(date_to)
            query = query.filter(Inspection.inspection_timestamp <= datetime.combine(d_to, datetime.max.time(), tzinfo=timezone.utc))
        except ValueError:
            raise ValidationError("date_to must be in YYYY-MM-DD format")

    total = query.count()
    paginated = query.order_by(Inspection.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    total_pages = (total + per_page - 1) // per_page if total > 0 else 1

    return jsonify({
        "inspections": [i.to_dict(include_details=True) for i in paginated],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": total_pages,
    }), 200


@inspections_bp.route("/<int:inspection_id>", methods=["GET"])
@require_permission("inspection.view")
def get_inspection(inspection_id, current_user):
    """Get single inspection details with product, batch, inspector, and image metadata."""
    inspection = db.session.get(Inspection, inspection_id)
    if not inspection:
        raise NotFoundError("Inspection not found")

    return jsonify({"inspection": inspection.to_dict(include_details=True)}), 200


@inspections_bp.route("", methods=["POST"])
@require_permission("inspection.create")
def create_inspection(current_user):
    """Create a new inspection intake linked to an active product and batch.

    Body: { product_id, batch_id, sample_reference?, sample_type?, observations? }
    """
    data = request.get_json(silent=True)
    if not data:
        raise ValidationError("JSON body required")

    product_id = data.get("product_id")
    batch_id = data.get("batch_id")
    sample_reference = (data.get("sample_reference") or "").strip() or None
    sample_type = (data.get("sample_type") or SampleType.ITEM.value).strip().lower()
    observations = (data.get("observations") or "").strip() or None

    errors: dict[str, str] = {}

    if not product_id:
        errors["product_id"] = "Product ID is required"
    else:
        product = db.session.get(Product, product_id)
        if not product:
            errors["product_id"] = f"Product with ID {product_id} does not exist"
        elif not product.is_active:
            errors["product_id"] = "Cannot create inspection for an archived product"

    if not batch_id:
        errors["batch_id"] = "Batch ID is required"
    else:
        batch = db.session.get(Batch, batch_id)
        if not batch:
            errors["batch_id"] = f"Batch with ID {batch_id} does not exist"
        elif batch.product_id != product_id:
            errors["batch_id"] = f"Batch '{batch.batch_number}' does not belong to the selected product"
        elif batch.status == BatchStatus.ARCHIVED.value:
            errors["batch_id"] = "Cannot create inspection for an archived batch"

    if sample_type not in VALID_SAMPLE_TYPES:
        errors["sample_type"] = f"Sample type must be one of: {', '.join(sorted(VALID_SAMPLE_TYPES))}"

    if errors:
        raise ValidationError("Validation failed", details=errors)

    inspection = Inspection(
        product_id=product_id,
        batch_id=batch_id,
        inspector_id=current_user.id,
        sample_reference=sample_reference,
        sample_type=sample_type,
        observations=observations,
        status=InspectionStatus.PENDING_UPLOAD.value,
        inspection_timestamp=datetime.now(timezone.utc),
    )
    db.session.add(inspection)
    db.session.flush()

    # Log audit event
    log_audit_event(
        actor_id=current_user.id,
        action="inspection.create",
        entity_type="inspection",
        entity_id=inspection.id,
        details={
            "product_id": inspection.product_id,
            "batch_id": inspection.batch_id,
            "sample_reference": inspection.sample_reference,
            "sample_type": inspection.sample_type,
        },
    )
    db.session.commit()

    return jsonify({
        "message": "Inspection created successfully",
        "inspection": inspection.to_dict(include_details=True),
    }), 201


@inspections_bp.route("/<int:inspection_id>", methods=["PATCH"])
@require_permission("inspection.create")
def update_inspection_draft(inspection_id, current_user):
    """Update editable draft inspection fields (observations, sample_reference).

    Once an inspection moves past intake into review/reviewed states,
    immutable fields cannot be modified.
    """
    inspection = db.session.get(Inspection, inspection_id)
    if not inspection:
        raise NotFoundError("Inspection not found")

    # Only creator, supervisor, or quality manager can edit draft
    if current_user.role == "inspector" and inspection.inspector_id != current_user.id:
        raise ForbiddenError("You can only edit your own inspection drafts")

    # Disallow modifications to finalized inspections
    if inspection.status not in EDITABLE_STATUSES:
        raise ValidationError(
            f"Cannot modify inspection in '{inspection.status}' state. Only draft/pending states allow edits."
        )

    data = request.get_json(silent=True)
    if not data:
        raise ValidationError("JSON body required")

    changes = {}

    if "observations" in data:
        new_obs = (data["observations"] or "").strip() or None
        if new_obs != inspection.observations:
            changes["observations"] = {"from": inspection.observations, "to": new_obs}
            inspection.observations = new_obs

    if "sample_reference" in data:
        new_ref = (data["sample_reference"] or "").strip() or None
        if new_ref != inspection.sample_reference:
            changes["sample_reference"] = {"from": inspection.sample_reference, "to": new_ref}
            inspection.sample_reference = new_ref

    if "sample_type" in data:
        new_type = (data["sample_type"] or "").strip().lower()
        if new_type not in VALID_SAMPLE_TYPES:
            raise ValidationError(f"Invalid sample type. Allowed: {', '.join(sorted(VALID_SAMPLE_TYPES))}")
        if new_type != inspection.sample_type:
            changes["sample_type"] = {"from": inspection.sample_type, "to": new_type}
            inspection.sample_type = new_type

    if changes:
        log_audit_event(
            actor_id=current_user.id,
            action="inspection.draft_update",
            entity_type="inspection",
            entity_id=inspection.id,
            details=changes,
        )
        db.session.commit()

    return jsonify({
        "message": "Inspection updated successfully",
        "inspection": inspection.to_dict(include_details=True),
    }), 200


@inspections_bp.route("/<int:inspection_id>/images", methods=["POST"])
@require_permission("inspection.upload_image")
def upload_inspection_images(inspection_id, current_user):
    """Upload one or more photographic evidence files for an inspection.

    Accepts multipart/form-data with file fields named 'images' or 'file'.
    Returns per-file status indicating which succeeded and which failed.
    """
    inspection = db.session.get(Inspection, inspection_id)
    if not inspection:
        raise NotFoundError("Inspection not found")

    # Inspect uploaded files
    uploaded_files = []
    # Check 'images' multi-upload field first
    if "images" in request.files:
        uploaded_files = request.files.getlist("images")
    elif "image" in request.files:
        uploaded_files = [request.files["image"]]
    elif "file" in request.files:
        uploaded_files = [request.files["file"]]

    # Filter out empty entries
    valid_file_storages = [f for f in uploaded_files if f and f.filename]

    if not valid_file_storages:
        raise ValidationError("No image file provided in multipart request")

    sample_type = request.form.get("sample_type") or inspection.sample_type

    succeeded = []
    failed = []

    for f in valid_file_storages:
        image_record, error_dict = save_inspection_image(
            inspection_id=inspection.id,
            user_id=current_user.id,
            file_storage=f,
            sample_type=sample_type,
        )
        if image_record:
            # Process ML inference in a nested transaction (savepoint)
            # so one failed prediction does not roll back the image record or other images
            try:
                with db.session.begin_nested():
                    process_inspection_image_ml(image_record)
            except Exception as ml_err:
                current_app.logger.error(
                    f"ML inference transaction error for image {image_record.id}: {str(ml_err)}"
                )
            succeeded.append(image_record.to_dict())
        else:
            failed.append(error_dict)

    if succeeded:
        # If status was pending_upload, transition to pending_review
        if inspection.status == InspectionStatus.PENDING_UPLOAD.value:
            inspection.status = InspectionStatus.PENDING_REVIEW.value

        # Log audit event
        log_audit_event(
            actor_id=current_user.id,
            action="inspection.image_upload",
            entity_type="inspection",
            entity_id=inspection.id,
            details={
                "uploaded_count": len(succeeded),
                "failed_count": len(failed),
                "image_ids": [s["id"] for s in succeeded],
            },
        )
        db.session.commit()

    status_code = 201 if succeeded else 422

    return jsonify({
        "message": f"Processed {len(valid_file_storages)} file(s): {len(succeeded)} succeeded, {len(failed)} failed",
        "succeeded": succeeded,
        "failed": failed,
        "total_uploaded": len(succeeded),
        "inspection": inspection.to_dict(include_details=True),
    }), status_code


@inspections_bp.route("/<int:inspection_id>/images/<int:image_id>", methods=["GET"])
@require_permission("inspection.view")
def get_inspection_image_file(inspection_id, image_id, current_user):
    """Securely serve authenticated inspection image evidence.

    Verifies user authorization, confirms image belongs to the inspection,
    and streams the image with appropriate caching and security headers.
    """
    image = db.session.get(InspectionImage, image_id)
    if not image or image.inspection_id != inspection_id:
        raise NotFoundError("Image not found for this inspection")

    file_path = get_image_file_path(image)
    if not file_path:
        raise NotFoundError("Image file missing from storage system")

    # Stream file securely with anti-sniffing headers
    response = send_file(
        file_path,
        mimetype=image.content_type,
        as_attachment=False,
        download_name=image.original_filename,
    )
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["Cache-Control"] = "private, max-age=86400"
    return response
