"""Batch decisions API — attributed hold/release decisions.

Phase 2 additions:
  - GET  /api/batch-decisions/context/<batch_id>  — live quality evidence preview
  - POST /api/batch-decisions                     — create hold/release decision (now with policy check)
  - GET  /api/batch-decisions                     — list decisions
  - GET  /api/batch-decisions/<id>                — single decision

Release policy (prototype):
  BLOCKING — release refused automatically:
    (none — QM may override any situation with a reason)
  ADVISORY — warnings shown, QM must acknowledge:
    • Incomplete item analysis exists
    • Unreviewed inspections exist
    • Open corrective actions exist
    • Confirmed defects with critical/major/high severity exist
  The policy is intentionally permissive; the human must supply a reason
  explaining any advisory condition they are overriding.
"""

from flask import Blueprint, jsonify, request

from backend.extensions import db
from backend.models.batch_decision import BatchDecision
from backend.models.batch import Batch, BatchStatus
from backend.models.inspection import Inspection, InspectionStatus
from backend.models.inspection_item import InspectionItem, ItemStatus
from backend.models.defect import Defect, DefectStatus
from backend.models.corrective_action import CorrectiveAction, ActionStatus
from backend.middleware.permissions import require_permission
from backend.middleware.errors import NotFoundError, ValidationError, ForbiddenError
from backend.services.audit_service import log_audit_event

batch_decisions_bp = Blueprint(
    "batch_decisions", __name__, url_prefix="/api/batch-decisions"
)

VALID_DECISIONS = {"hold", "release"}


def _build_context(batch: Batch) -> dict:
    """Compute live quality evidence for a batch decision."""
    batch_id = batch.id

    total_inspected = batch.inspections.count()
    total_reviewed = batch.inspections.filter_by(
        status=InspectionStatus.REVIEWED.value
    ).count()
    unreviewed = total_inspected - total_reviewed

    # A defect linked to a human review is confirmed; model-generated records
    # without a review remain suggestions and are not counted as confirmed.
    confirmed_defects_q = (
        db.session.query(Defect)
        .join(Inspection, Defect.inspection_id == Inspection.id)
        .filter(Inspection.batch_id == batch_id)
        .filter(Defect.review_id.isnot(None))
    )
    total_confirmed_defects = confirmed_defects_q.count()

    open_defects = confirmed_defects_q.filter(
        Defect.status.in_([
            DefectStatus.OPEN.value,
            DefectStatus.IN_PROGRESS.value,
            DefectStatus.REOPENED.value,
        ])
    ).count()

    critical_defects = confirmed_defects_q.filter(
        Defect.severity.in_(["critical", "major", "high"]),
        Defect.status.in_([
            DefectStatus.OPEN.value,
            DefectStatus.IN_PROGRESS.value,
            DefectStatus.REOPENED.value,
        ]),
    ).count()

    # Open corrective actions linked to this batch's defects
    open_actions = (
        db.session.query(CorrectiveAction)
        .join(Defect, CorrectiveAction.defect_id == Defect.id)
        .join(Inspection, Defect.inspection_id == Inspection.id)
        .filter(Inspection.batch_id == batch_id)
        .filter(CorrectiveAction.status.in_(
            [ActionStatus.OPEN.value, ActionStatus.IN_PROGRESS.value, ActionStatus.REOPENED.value]
        ))
        .count()
    )

    item_query = (
        db.session.query(InspectionItem)
        .join(Inspection, InspectionItem.inspection_id == Inspection.id)
        .filter(Inspection.batch_id == batch_id)
    )
    total_items = item_query.count()
    analyzed_items = item_query.filter(
        InspectionItem.status == ItemStatus.ANALYZED
    ).count()
    pending_upload_items = item_query.filter(
        InspectionItem.status == ItemStatus.PENDING_UPLOAD
    ).count()
    uploaded_items = item_query.filter(
        InspectionItem.status == ItemStatus.UPLOADED
    ).count()

    # Build advisory warnings
    advisories = []
    if unreviewed > 0:
        advisories.append({
            "code": "unreviewed_inspections",
            "message": f"{unreviewed} inspection(s) have no human review decision yet.",
        })
    incomplete_items = total_items - analyzed_items
    if incomplete_items > 0:
        advisories.append({
            "code": "incomplete_item_analysis",
            "message": (
                f"{incomplete_items} of {total_items} allocated item(s) "
                "have not completed model analysis."
            ),
        })
    if critical_defects > 0:
        advisories.append({
            "code": "critical_defects_open",
            "message": f"{critical_defects} critical/major defect(s) are still open.",
        })
    if open_actions > 0:
        advisories.append({
            "code": "open_corrective_actions",
            "message": f"{open_actions} corrective action(s) are still open or in-progress.",
        })

    return {
        "batch_id": batch_id,
        "batch_number": batch.batch_number,
        "batch_status": batch.status,
        "total_inspected": total_inspected,
        "total_reviewed": total_reviewed,
        "unreviewed_inspections": unreviewed,
        "total_confirmed_defects": total_confirmed_defects,
        "open_defects": open_defects,
        "critical_defects_open": critical_defects,
        "total_open_actions": open_actions,
        "total_items": total_items,
        "analyzed_items": analyzed_items,
        "uploaded_items": uploaded_items,
        "pending_upload_items": pending_upload_items,
        "advisories": advisories,
        "release_blocked": False,  # Policy: no hard blocks — QM overrides with reason
    }


@batch_decisions_bp.route("/context/<int:batch_id>", methods=["GET"])
@require_permission("batch_decision.view")
def get_decision_context(batch_id, current_user):
    """Return live quality evidence for a batch before making a hold/release decision."""
    batch = db.session.get(Batch, batch_id)
    if not batch:
        raise NotFoundError("Batch not found")
    return jsonify({"context": _build_context(batch)}), 200


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
    """Hold or release a batch.

    Body: { batch_id, decision, reason, acknowledge_advisories? }
    decision must be 'hold' or 'release'.

    - 'release' is restricted to quality_manager role.
    - 'hold' is available to supervisor and quality_manager.
    - reason is always required.
    - Snapshots inspection, item, defect, and action evidence at decision time.
    - Advisory warnings are computed server-side and returned; none are hard blocks.
    """
    from backend.models.user import UserRole

    data = request.get_json(silent=True)
    if not data:
        raise ValidationError("JSON body required")

    batch_id = data.get("batch_id")
    decision = (data.get("decision") or "").strip().lower()
    reason = (data.get("reason") or "").strip()

    errors: dict[str, str] = {}

    batch = None
    if not batch_id:
        errors["batch_id"] = "Batch ID is required"
    else:
        batch = db.session.get(Batch, batch_id)
        if not batch:
            errors["batch_id"] = f"Batch {batch_id} not found"

    if decision not in VALID_DECISIONS:
        errors["decision"] = "Decision must be 'hold' or 'release'"

    if not reason or len(reason.strip()) < 5:
        errors["reason"] = "A meaningful reason (≥ 5 characters) is required"

    if errors:
        raise ValidationError("Validation failed", details=errors)

    # Permission check: only QMs can release
    if decision == "release" and current_user.role != UserRole.QUALITY_MANAGER.value:
        raise ForbiddenError("Only a Quality Manager can release a batch")

    # Valid transition check
    terminal_statuses = {BatchStatus.RELEASED.value, BatchStatus.ARCHIVED.value}
    if batch.status in terminal_statuses:
        raise ValidationError(
            f"Batch is already '{batch.status}' and cannot be transitioned"
        )

    if decision == "hold" and batch.status == BatchStatus.ON_HOLD.value:
        raise ValidationError("Batch is already on hold")

    # Snapshot context at decision time
    ctx = _build_context(batch)
    advisories_acknowledged = (
        decision == "release" and data.get("acknowledge_advisories") is True
    )
    if decision == "release" and ctx["advisories"] and not advisories_acknowledged:
        raise ValidationError(
            "Review and acknowledge all advisory conditions before releasing this batch",
            details={"acknowledge_advisories": "Acknowledgement is required"},
        )

    if decision == "release" and batch.status not in {
        BatchStatus.PRODUCED.value,
        BatchStatus.UNDER_INSPECTION.value,
        BatchStatus.ON_HOLD.value,
    }:
        raise ValidationError(
            f"A batch in '{batch.status}' cannot be released; "
            "it must be produced, under inspection, or on hold"
        )

    if decision == "hold" and batch.status not in {
        BatchStatus.IN_PRODUCTION.value,
        BatchStatus.PRODUCED.value,
        BatchStatus.UNDER_INSPECTION.value,
    }:
        raise ValidationError(
            f"A batch in '{batch.status}' cannot be placed on hold"
        )

    batch_decision = BatchDecision(
        batch_id=batch_id,
        decision=decision,
        reason=reason,
        decided_by_id=current_user.id,
        total_inspected=ctx["total_inspected"],
        total_reviewed=ctx["total_reviewed"],
        total_confirmed_defects=ctx["total_confirmed_defects"],
        total_open_actions=ctx["total_open_actions"],
        advisories_acknowledged=advisories_acknowledged,
        evidence_snapshot=ctx,
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
                "total_inspected": ctx["total_inspected"],
                "total_reviewed": ctx["total_reviewed"],
                "total_confirmed_defects": ctx["total_confirmed_defects"],
                "total_open_actions": ctx["total_open_actions"],
                "evidence_snapshot": ctx,
                "advisories_acknowledged": advisories_acknowledged,
            },
        },
    )
    db.session.commit()

    return jsonify({
        "message": f"Batch '{batch.batch_number}' {decision} decision recorded",
        "batch_decision": batch_decision.to_dict(),
        "batch": batch.to_dict(include_product=True),
        "context": ctx,
    }), 201
