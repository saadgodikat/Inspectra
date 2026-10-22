"""Batch decisions API — 21 CFR Part 11 hold/release workflow (Quality Manager only)."""

from flask import Blueprint, jsonify, request

from backend.extensions import db
from backend.models.batch_decision import BatchDecision
from backend.models.batch import Batch, BatchStatus
from backend.models.inspection import Inspection, InspectionStatus
from backend.models.defect import Defect
from backend.middleware.permissions import require_permission
from backend.middleware.errors import NotFoundError, ValidationError, ForbiddenError
from backend.services.audit_service import log_audit_event

batch_decisions_bp = Blueprint(
    "batch_decisions", __name__, url_prefix="/api/batch-decisions"
)

VALID_DECISIONS = {"hold", "release"}


@batch_decisions_bp.route("", methods=["GET"])
@require_permission("batch_decision.view")
def list_batch_decisions(current_user):
    """List batch decisions with optional filters.

    Query params: batch_id, decision, page, per_page
    """
    batch_id = request.args.get("batch_id", type=int)
    decision_filter = request.args.get("decision", "").strip().lower()
    page = max(1, request.args.get("page", 1, type=int))
    per_page = min(100, max(1, request.args.get("per_page", 20, type=int)))

    query = BatchDecision.query

    if batch_id:
        query = query.filter_by(batch_id=batch_id)
    if decision_filter and decision_filter != "all":
        query = query.filter_by(decision=decision_filter)

    total = query.count()
    decisions = (
        query.order_by(BatchDecision.decision_timestamp.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return jsonify({
        "batch_decisions": [d.to_dict() for d in decisions],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total + per_page - 1) // per_page),
    }), 200


@batch_decisions_bp.route("/<int:decision_id>", methods=["GET"])
@require_permission("batch_decision.view")
def get_batch_decision(decision_id, current_user):
    decision = db.session.get(BatchDecision, decision_id)
    if not decision:
        raise NotFoundError("Batch decision not found")
    return jsonify({"batch_decision": decision.to_dict()}), 200


@batch_decisions_bp.route("", methods=["POST"])
@require_permission("batch_decision.create")
def create_batch_decision(current_user):
    """Hold or release a batch (Quality Manager only).

    Body: { batch_id, decision, reason }
    decision must be 'hold' or 'release'.

    Automatically snapshots inspection/defect counts at decision time
    and transitions the batch status accordingly.
    """
    data = request.get_json(silent=True)
    if not data:
        raise ValidationError("JSON body required")

    batch_id = data.get("batch_id")
    decision = (data.get("decision") or "").strip().lower()
    reason = (data.get("reason") or "").strip()

    errors: dict[str, str] = {}

    if not batch_id:
        errors["batch_id"] = "Batch ID is required"
    else:
        batch = db.session.get(Batch, batch_id)
        if not batch:
            errors["batch_id"] = f"Batch {batch_id} not found"

    if decision not in VALID_DECISIONS:
        errors["decision"] = "Decision must be 'hold' or 'release'"

    if not reason:
        errors["reason"] = "Reason is required for batch decisions"

    if errors:
        raise ValidationError("Validation failed", details=errors)

    # Snapshot counts at decision time
    total_inspected = batch.inspections.count()
    total_reviewed = batch.inspections.filter_by(
        status=InspectionStatus.REVIEWED.value
    ).count()
    total_confirmed_defects = (
        db.session.query(Defect)
        .join(Inspection, Defect.inspection_id == Inspection.id)
        .filter(Inspection.batch_id == batch_id)
        .count()
    )

    batch_decision = BatchDecision(
        batch_id=batch_id,
        decision=decision,
        reason=reason,
        decided_by_id=current_user.id,
        total_inspected=total_inspected,
        total_reviewed=total_reviewed,
        total_confirmed_defects=total_confirmed_defects,
    )
    db.session.add(batch_decision)

    # Transition batch status
    old_status = batch.status
    batch.status = BatchStatus.ON_HOLD.value if decision == "hold" else BatchStatus.RELEASED.value

    log_audit_event(
        actor_id=current_user.id,
        action=f"batch.{decision}",
        entity_type="batch_decision",
        entity_id=batch_decision.id,
        details={
            "batch_id": batch_id,
            "batch_number": batch.batch_number,
            "from_status": old_status,
            "to_status": batch.status,
            "reason": reason,
            "snapshot": {
                "total_inspected": total_inspected,
                "total_reviewed": total_reviewed,
                "total_confirmed_defects": total_confirmed_defects,
            },
        },
    )
    db.session.commit()

    return jsonify({
        "message": f"Batch '{batch.batch_number}' {decision} decision recorded",
        "batch_decision": batch_decision.to_dict(),
        "batch": batch.to_dict(include_product=True),
    }), 201
