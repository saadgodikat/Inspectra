"""Batches API endpoints — CRUD, status lifecycle, archival, and filtering."""

from datetime import date
from flask import Blueprint, jsonify, request
from sqlalchemy import or_

from backend.extensions import db
from backend.models.batch import Batch, BatchStatus
from backend.models.product import Product
from backend.middleware.permissions import require_permission
from backend.middleware.errors import NotFoundError, ValidationError, ConflictError
from backend.services.audit_service import log_audit_event

batches_bp = Blueprint("batches", __name__, url_prefix="/api/batches")

VALID_STATUSES = {s.value for s in BatchStatus}


@batches_bp.route("", methods=["GET"])
@require_permission("batch.view")
def list_batches(current_user):
    """List batches with optional search and filters.

    Query params:
      - search: string (matches batch_number, line, supplier)
      - product_id: integer
      - status: string (e.g. 'under_inspection', 'on_hold', 'released', etc.)
    """
    search = request.args.get("search", "").strip()
    product_id = request.args.get("product_id", type=int)
    status = request.args.get("status", "").strip().lower()

    query = Batch.query

    if product_id:
        query = query.filter_by(product_id=product_id)

    if status and status != "all":
        query = query.filter_by(status=status)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Batch.batch_number.ilike(search_pattern),
                Batch.production_line.ilike(search_pattern),
                Batch.supplier.ilike(search_pattern),
            )
        )

    batches = query.order_by(Batch.created_at.desc()).all()
    return jsonify({
        "batches": [b.to_dict(include_product=True) for b in batches],
        "count": len(batches),
    }), 200


@batches_bp.route("/<int:batch_id>", methods=["GET"])
@require_permission("batch.view")
def get_batch(batch_id, current_user):
    """Get single batch details, including inspection statistics."""
    batch = db.session.get(Batch, batch_id)
    if not batch:
        raise NotFoundError("Batch not found")

    data = batch.to_dict(include_product=True)
    data["inspection_count"] = batch.inspections.count()
    return jsonify({"batch": data}), 200


@batches_bp.route("", methods=["POST"])
@require_permission("batch.create")
def create_batch(current_user):
    """Create a new batch (Supervisor & Quality Manager).

    Body: { batch_number, product_id, production_date?, quantity?, production_line?, supplier?, status? }
    """
    data = request.get_json(silent=True)
    if not data:
        raise ValidationError("JSON body required")

    batch_number = (data.get("batch_number") or "").strip().upper()
    product_id = data.get("product_id")
    production_date_raw = data.get("production_date")
    quantity = data.get("quantity")
    production_line = (data.get("production_line") or "").strip() or None
    supplier = (data.get("supplier") or "").strip() or None
    status = (data.get("status") or BatchStatus.CREATED.value).strip().lower()

    errors: dict[str, str] = {}

    if not batch_number:
        errors["batch_number"] = "Batch number is required"
    elif len(batch_number) > 100:
        errors["batch_number"] = "Batch number must be <= 100 characters"

    if not product_id:
        errors["product_id"] = "Product ID is required"
    else:
        product = db.session.get(Product, product_id)
        if not product:
            errors["product_id"] = f"Product with ID {product_id} does not exist"
        elif not product.is_active:
            errors["product_id"] = "Cannot create batch for an archived product"

    if status not in VALID_STATUSES:
        errors["status"] = f"Status must be one of: {', '.join(sorted(VALID_STATUSES))}"

    parsed_date = None
    if production_date_raw:
        try:
            parsed_date = date.fromisoformat(production_date_raw)
        except ValueError:
            errors["production_date"] = "Production date must be in YYYY-MM-DD format"

    if quantity is not None:
        try:
            quantity = int(quantity)
            if quantity < 0:
                errors["quantity"] = "Quantity must be a non-negative integer"
        except (ValueError, TypeError):
            errors["quantity"] = "Quantity must be an integer"

    if errors:
        raise ValidationError("Validation failed", details=errors)

    # Check unique batch number
    existing = Batch.query.filter_by(batch_number=batch_number).first()
    if existing:
        raise ConflictError(f"Batch number '{batch_number}' already exists")

    batch = Batch(
        batch_number=batch_number,
        product_id=product_id,
        production_date=parsed_date,
        quantity=quantity,
        status=status,
        production_line=production_line,
        supplier=supplier,
    )
    db.session.add(batch)
    db.session.flush()

    # Log audit event
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
        },
    )
    db.session.commit()

    return jsonify({
        "message": "Batch created successfully",
        "batch": batch.to_dict(include_product=True),
    }), 201


@batches_bp.route("/<int:batch_id>", methods=["PUT"])
@require_permission("batch.edit")
def update_batch(batch_id, current_user):
    """Update batch details (Supervisor & Quality Manager).

    Body: { batch_number?, production_date?, quantity?, production_line?, supplier?, status? }
    """
    batch = db.session.get(Batch, batch_id)
    if not batch:
        raise NotFoundError("Batch not found")

    data = request.get_json(silent=True)
    if not data:
        raise ValidationError("JSON body required")

    changes = {}

    if "batch_number" in data:
        new_num = (data["batch_number"] or "").strip().upper()
        if not new_num:
            raise ValidationError("Batch number cannot be empty")
        if new_num != batch.batch_number:
            existing = Batch.query.filter_by(batch_number=new_num).first()
            if existing and existing.id != batch.id:
                raise ConflictError(f"Batch number '{new_num}' already exists")
            changes["batch_number"] = {"from": batch.batch_number, "to": new_num}
            batch.batch_number = new_num

    if "production_date" in data:
        raw = data["production_date"]
        if raw is None or raw == "":
            changes["production_date"] = {"from": str(batch.production_date), "to": None}
            batch.production_date = None
        else:
            try:
                parsed = date.fromisoformat(raw)
                changes["production_date"] = {"from": str(batch.production_date), "to": str(parsed)}
                batch.production_date = parsed
            except ValueError:
                raise ValidationError("Production date must be YYYY-MM-DD")

    if "quantity" in data:
        val = data["quantity"]
        if val is None or val == "":
            batch.quantity = None
        else:
            try:
                qty = int(val)
                if qty < 0:
                    raise ValidationError("Quantity cannot be negative")
                changes["quantity"] = {"from": batch.quantity, "to": qty}
                batch.quantity = qty
            except (ValueError, TypeError):
                raise ValidationError("Quantity must be an integer")

    if "production_line" in data:
        line = (data["production_line"] or "").strip() or None
        changes["production_line"] = {"from": batch.production_line, "to": line}
        batch.production_line = line

    if "supplier" in data:
        sup = (data["supplier"] or "").strip() or None
        changes["supplier"] = {"from": batch.supplier, "to": sup}
        batch.supplier = sup

    if "status" in data:
        st = (data["status"] or "").strip().lower()
        if st not in VALID_STATUSES:
            raise ValidationError(f"Status must be one of: {', '.join(sorted(VALID_STATUSES))}")
        if st != batch.status:
            changes["status"] = {"from": batch.status, "to": st}
            batch.status = st

    if changes:
        log_audit_event(
            actor_id=current_user.id,
            action="batch.update",
            entity_type="batch",
            entity_id=batch.id,
            details=changes,
        )
        db.session.commit()

    return jsonify({
        "message": "Batch updated successfully",
        "batch": batch.to_dict(include_product=True),
    }), 200


@batches_bp.route("/<int:batch_id>/status", methods=["POST"])
@require_permission("batch.edit")
def update_batch_status(batch_id, current_user):
    """Transition batch status (Supervisor & Quality Manager).

    Body: { status: string, reason?: string }
    """
    batch = db.session.get(Batch, batch_id)
    if not batch:
        raise NotFoundError("Batch not found")

    data = request.get_json(silent=True) or {}
    new_status = (data.get("status") or "").strip().lower()
    reason = (data.get("reason") or "").strip()

    if new_status not in VALID_STATUSES:
        raise ValidationError(f"Invalid status. Must be one of: {', '.join(sorted(VALID_STATUSES))}")

    # Note: on_hold and released batch decisions are managed via Phase 6 batch_decision workflow,
    # but operational updates like under_inspection, in_production, produced, archived are handled here.
    old_status = batch.status
    batch.status = new_status

    log_audit_event(
        actor_id=current_user.id,
        action="batch.status_change",
        entity_type="batch",
        entity_id=batch.id,
        details={
            "from_status": old_status,
            "to_status": new_status,
            "reason": reason,
        },
    )
    db.session.commit()

    return jsonify({
        "message": f"Batch status transitioned from '{old_status}' to '{new_status}'",
        "batch": batch.to_dict(include_product=True),
    }), 200


@batches_bp.route("/<int:batch_id>/archive", methods=["POST"])
@require_permission("batch.edit")
def archive_batch(batch_id, current_user):
    """Archive a batch. Retains historical inspection link integrity."""
    batch = db.session.get(Batch, batch_id)
    if not batch:
        raise NotFoundError("Batch not found")

    if batch.status == BatchStatus.ARCHIVED.value:
        return jsonify({
            "message": "Batch is already archived",
            "batch": batch.to_dict(include_product=True),
        }), 200

    old_status = batch.status
    batch.status = BatchStatus.ARCHIVED.value

    log_audit_event(
        actor_id=current_user.id,
        action="batch.archive",
        entity_type="batch",
        entity_id=batch.id,
        details={"from_status": old_status},
    )
    db.session.commit()

    return jsonify({
        "message": "Batch archived successfully",
        "batch": batch.to_dict(include_product=True),
    }), 200
