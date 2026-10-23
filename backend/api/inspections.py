"""Inspections API endpoints — intake, image uploads, secure evidence delivery, and listing."""

from datetime import datetime, timezone, date
from secrets import token_hex
from flask import Blueprint, jsonify, request, send_file, current_app
from sqlalchemy import case, func, or_

from backend.extensions import db
from backend.models.inspection import Inspection, InspectionStatus, SampleType
from backend.models.inspection_image import InspectionImage
from backend.models.inspection_item import InspectionItem, ItemStatus
from backend.models.ml_result import MLResult
from backend.models.product import Product
from backend.models.batch import Batch, BatchStatus
from backend.models.user import UserRole
from backend.middleware.permissions import require_permission
from backend.middleware.errors import NotFoundError, ValidationError, ForbiddenError
from backend.services.audit_service import log_audit_event
from backend.services.file_service import save_inspection_image, get_image_file_path
from backend.services.ml_service import process_inspection_image_ml
from inspectra_ml.multiclass_inference import predict_multiclass_image
import os

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
    reinspection_of_id = request.args.get("reinspection_of_id", type=int)

    page = max(1, request.args.get("page", 1, type=int))
    per_page = min(100, max(1, request.args.get("per_page", 20, type=int)))

    query = Inspection.query

    if product_id:
        query = query.filter_by(product_id=product_id)

    if batch_id:
        query = query.filter_by(batch_id=batch_id)

    if inspector_id:
        query = query.filter_by(inspector_id=inspector_id)

    if reinspection_of_id:
        query = query.filter_by(reinspection_of_id=reinspection_of_id)

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

    inspection_data = [i.to_dict(include_details=True) for i in paginated]
    inspection_ids = [inspection.id for inspection in paginated]
    item_summaries = {}
    if inspection_ids:
        item_summary_rows = (
            db.session.query(
                InspectionItem.inspection_id,
                func.count(InspectionItem.id).label("total"),
                func.sum(
                    case(
                        (InspectionItem.status == ItemStatus.ANALYZED, 1),
                        else_=0,
                    )
                ).label("analyzed"),
                func.sum(
                    case(
                        (
                            (InspectionItem.status == ItemStatus.ANALYZED)
                            & (
                                func.coalesce(
                                    InspectionItem.override_decision,
                                    MLResult.predicted_class,
                                )
                                == "good"
                            ),
                            1,
                        ),
                        else_=0,
                    )
                ).label("good"),
                func.sum(
                    case(
                        (
                            (InspectionItem.status == ItemStatus.ANALYZED)
                            & (
                                func.coalesce(
                                    InspectionItem.override_decision,
                                    MLResult.predicted_class,
                                )
                                == "defective"
                            ),
                            1,
                        ),
                        else_=0,
                    )
                ).label("defective"),
            )
            .outerjoin(MLResult, InspectionItem.ml_result_id == MLResult.id)
            .filter(InspectionItem.inspection_id.in_(inspection_ids))
            .group_by(InspectionItem.inspection_id)
            .all()
        )
        item_summaries = {
            row.inspection_id: {
                "total": row.total,
                "analyzed": row.analyzed,
                "good": row.good,
                "defective": row.defective,
            }
            for row in item_summary_rows
        }

    for inspection, data in zip(paginated, inspection_data):
        data["item_summary"] = item_summaries.get(
            inspection.id,
            {"total": 0, "analyzed": 0, "good": 0, "defective": 0},
        )

    return jsonify({
        "inspections": inspection_data,
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

    Body: { product_id, batch_id, quantity?, sample_reference?, sample_type?, observations? }
    """
    data = request.get_json(silent=True)
    if not data:
        raise ValidationError("JSON body required")

    product_id = data.get("product_id")
    batch_id = data.get("batch_id")
    sample_reference = (data.get("sample_reference") or "").strip() or None
    sample_type = (data.get("sample_type") or SampleType.ITEM.value).strip().lower()
    observations = (data.get("observations") or "").strip() or None
    requested_quantity = data.get("quantity")
    reinspection_of_id = data.get("reinspection_of_id")

    errors: dict[str, str] = {}
    batch = None
    parent_inspection = None

    if reinspection_of_id:
        parent_inspection = db.session.get(Inspection, reinspection_of_id)
        if not parent_inspection:
            errors["reinspection_of_id"] = f"Parent inspection with ID {reinspection_of_id} does not exist"
        else:
            if not product_id:
                product_id = parent_inspection.product_id
            if not batch_id:
                batch_id = parent_inspection.batch_id

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

    batch_quantity = batch.quantity or 0
    quantity = batch_quantity
    if requested_quantity is not None:
        if isinstance(requested_quantity, bool) or not isinstance(requested_quantity, int):
            errors["quantity"] = "Quantity must be a whole number"
        elif requested_quantity < 1:
            errors["quantity"] = "Quantity must be at least 1"
        elif batch.quantity is not None and requested_quantity > batch_quantity:
            errors["quantity"] = "Quantity cannot exceed the selected batch quantity"
        else:
            quantity = requested_quantity

    if errors:
        raise ValidationError("Validation failed", details=errors)

    ref = sample_reference
    if not ref and parent_inspection:
        ref = f"Reinspection of INS-{parent_inspection.id:04d}"

    inspection = Inspection(
        product_id=product_id,
        batch_id=batch_id,
        inspector_id=current_user.id,
        sample_reference=ref,
        sample_type=sample_type,
        observations=observations,
        status=InspectionStatus.PENDING_UPLOAD.value,
        inspection_timestamp=datetime.now(timezone.utc),
        reinspection_of_id=parent_inspection.id if parent_inspection else None,
    )
    db.session.add(inspection)
    db.session.flush()

    # Auto-allocate item slots based on batch quantity
    if quantity > 0:
        for n in range(1, quantity + 1):
            db.session.add(InspectionItem(
                inspection_id=inspection.id,
                item_number=n,
                status=ItemStatus.PENDING_UPLOAD,
            ))

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
            "items_allocated": quantity,
            "reinspection_of_id": inspection.reinspection_of_id,
        },
    )
    db.session.commit()

    return jsonify({
        "message": "Inspection created successfully",
        "inspection": inspection.to_dict(include_details=True),
    }), 201


@inspections_bp.route("/with-batch", methods=["POST"])
@require_permission("inspection.create")
def create_inspection_with_batch(current_user):
    """Atomically create a production batch and its initial inspection."""
    data = request.get_json(silent=True)
    if not data:
        raise ValidationError("JSON body required")

    errors: dict[str, str] = {}
    product_id = data.get("product_id")
    if isinstance(product_id, bool) or not isinstance(product_id, int) or product_id < 1:
        errors["product_id"] = "Product ID is required"
        product = None
    else:
        product = db.session.get(Product, product_id)
        if not product:
            errors["product_id"] = f"Product with ID {product_id} does not exist"
        elif not product.is_active:
            errors["product_id"] = "Cannot create a batch for an archived product"

    quantity = data.get("quantity")
    if isinstance(quantity, bool) or not isinstance(quantity, int) or quantity < 1:
        errors["quantity"] = "Quantity must be a whole number of at least 1"

    production_date_raw = data.get("production_date")
    parsed_date = None
    if production_date_raw:
        if not isinstance(production_date_raw, str):
            errors["production_date"] = "Production date must be in YYYY-MM-DD format"
        else:
            try:
                parsed_date = date.fromisoformat(production_date_raw)
            except ValueError:
                errors["production_date"] = "Production date must be in YYYY-MM-DD format"

    def optional_text(field: str) -> str | None:
        value = data.get(field)
        if value is None:
            return None
        if not isinstance(value, str):
            errors[field] = f"{field.replace('_', ' ').capitalize()} must be text"
            return None
        return value.strip() or None

    production_line = optional_text("production_line")
    supplier = optional_text("supplier")
    sample_reference = optional_text("sample_reference")
    observations = optional_text("observations")

    sample_type_raw = data.get("sample_type", SampleType.ITEM.value)
    sample_type = (
        sample_type_raw.strip().lower()
        if isinstance(sample_type_raw, str)
        else ""
    )
    if sample_type not in VALID_SAMPLE_TYPES:
        errors["sample_type"] = (
            f"Sample type must be one of: {', '.join(sorted(VALID_SAMPLE_TYPES))}"
        )

    if errors:
        raise ValidationError("Validation failed", details=errors)

    batch = Batch(
        batch_number=f"BAT-{date.today():%Y%m%d}-{token_hex(4).upper()}",
        product_id=product.id,
        production_date=parsed_date,
        quantity=quantity,
        status=BatchStatus.UNDER_INSPECTION.value,
        production_line=production_line,
        supplier=supplier,
    )
    db.session.add(batch)
    db.session.flush()

    inspection = Inspection(
        product_id=product.id,
        batch_id=batch.id,
        inspector_id=current_user.id,
        sample_reference=sample_reference,
        sample_type=sample_type,
        observations=observations,
        status=InspectionStatus.PENDING_UPLOAD.value,
        inspection_timestamp=datetime.now(timezone.utc),
    )
    db.session.add(inspection)
    db.session.flush()

    for item_number in range(1, quantity + 1):
        db.session.add(InspectionItem(
            inspection_id=inspection.id,
            item_number=item_number,
            status=ItemStatus.PENDING_UPLOAD,
        ))

    log_audit_event(
        actor_id=current_user.id,
        action="batch.create",
        entity_type="batch",
        entity_id=batch.id,
        details={
            "batch_number": batch.batch_number,
            "product_id": batch.product_id,
            "status": batch.status,
            "quantity": batch.quantity,
            "created_with_inspection_id": inspection.id,
        },
    )
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
            "items_allocated": quantity,
            "created_batch": True,
        },
    )
    db.session.commit()

    return jsonify({
        "message": "Batch and inspection created successfully",
        "batch": batch.to_dict(include_product=True),
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
    if current_user.role == UserRole.INSPECTOR.value and inspection.inspector_id != current_user.id:
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


@inspections_bp.route("/<int:inspection_id>/ml-results", methods=["GET"])
@require_permission("inspection.view")
def get_ml_results(inspection_id, current_user):
    """Return all ML inference results for an inspection."""
    inspection = db.session.get(Inspection, inspection_id)
    if not inspection:
        raise NotFoundError("Inspection not found")

    results = MLResult.query.filter_by(inspection_id=inspection_id).order_by(MLResult.created_at.asc()).all()
    return jsonify({
        "inspection_id": inspection_id,
        "ml_results": [r.to_dict() for r in results],
        "count": len(results),
    }), 200

@inspections_bp.route("/<int:inspection_id>/multiclass-results", methods=["GET"])
@require_permission("inspection.view")
def get_multiclass_results(inspection_id, current_user):
    """Run multiclass inference on each image of an inspection and return results.

    Returns a list of prediction dicts per image, mirroring the MLResult schema but for multiclass.
    """
    inspection = db.session.get(Inspection, inspection_id)
    if not inspection:
        raise NotFoundError("Inspection not found")

    images = db.session.query(InspectionImage).filter_by(inspection_id=inspection_id).all()
    results = []
    for img in images:
        file_path = get_image_file_path(img)
        if not file_path or not os.path.isfile(file_path):
            result = {
                "image_id": img.id,
                "status": "failed",
                "error_code": "FILE_MISSING",
                "error_details": "Image file missing on disk.",
            }
            results.append(result)
            continue
        pred = predict_multiclass_image(file_path)
        result = {
            "image_id": img.id,
            "status": pred.get("status"),
            "predicted_class": pred.get("predicted_class"),
            "probabilities": pred.get("probabilities"),
            "confidence": pred.get("confidence"),
            "model_name": pred.get("model_name"),
            "model_version": pred.get("model_version"),
            "processing_duration_ms": pred.get("processing_duration_ms"),
            "error_code": pred.get("error_code"),
            "error_details": pred.get("error_details"),
        }
        results.append(result)

    return jsonify({
        "inspection_id": inspection_id,
        "multiclass_results": results,
        "count": len(results),
    }), 200
