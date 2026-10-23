"""Defects API endpoints — list, get, update severity/status."""

from flask import Blueprint, jsonify, request

from backend.extensions import db
from backend.models.defect import Defect, DefectSeverity, DefectStatus
from backend.models.corrective_action import CorrectiveAction
from backend.middleware.permissions import require_permission
from backend.middleware.errors import NotFoundError, ValidationError
from backend.services.audit_service import log_audit_event

defects_bp = Blueprint("defects", __name__, url_prefix="/api/defects")

VALID_SEVERITIES = {s.value for s in DefectSeverity}
VALID_STATUSES = {s.value for s in DefectStatus}


@defects_bp.route("", methods=["GET"])
@require_permission("defect.view")
def list_defects(current_user):
    """List defects with optional filters.

    Query params: inspection_id, severity, status, page, per_page
    """
    inspection_id = request.args.get("inspection_id", type=int)
    severity = request.args.get("severity", "").strip().lower()
    status = request.args.get("status", "").strip().lower()
    page = max(1, request.args.get("page", 1, type=int))
    per_page = min(100, max(1, request.args.get("per_page", 20, type=int)))

    query = Defect.query

    if inspection_id:
        query = query.filter_by(inspection_id=inspection_id)
    if severity and severity != "all":
        query = query.filter_by(severity=severity)
    if status and status != "all":
        query = query.filter_by(status=status)

    total = query.count()
    defects = (
        query.order_by(Defect.id.asc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return jsonify({
        "defects": [d.to_dict() for d in defects],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total + per_page - 1) // per_page),
    }), 200


@defects_bp.route("/<int:defect_id>", methods=["GET"])
@require_permission("defect.view")
def get_defect(defect_id, current_user):
    defect = db.session.get(Defect, defect_id)
    if not defect:
        raise NotFoundError("Defect not found")

    data = defect.to_dict()
    data["corrective_action_count"] = defect.corrective_actions.count()
    return jsonify({"defect": data}), 200


@defects_bp.route("/<int:defect_id>", methods=["PATCH"])
@require_permission("corrective_action.update")
def update_defect(defect_id, current_user):
    """Update defect severity or status (Supervisor & Quality Manager)."""
    defect = db.session.get(Defect, defect_id)
    if not defect:
        raise NotFoundError("Defect not found")

    data = request.get_json(silent=True)
    if not data:
        raise ValidationError("JSON body required")

    changes = {}

    if "severity" in data:
        sev = (data["severity"] or "").strip().lower()
        if sev not in VALID_SEVERITIES:
            raise ValidationError(f"Severity must be one of: {', '.join(sorted(VALID_SEVERITIES))}")
        if sev != defect.severity:
            changes["severity"] = {"from": defect.severity, "to": sev}
            defect.severity = sev

    if "status" in data:
        st = (data["status"] or "").strip().lower()
        if st not in VALID_STATUSES:
            raise ValidationError(f"Status must be one of: {', '.join(sorted(VALID_STATUSES))}")
        if st != defect.status:
            changes["status"] = {"from": defect.status, "to": st}
            defect.status = st

    if "description" in data:
        desc = (data["description"] or "").strip() or None
        changes["description"] = {"from": defect.description, "to": desc}
        defect.description = desc

    if changes:
        log_audit_event(
            actor_id=current_user.id,
            action="defect.update",
            entity_type="defect",
            entity_id=defect.id,
            details=changes,
        )
        db.session.commit()

    return jsonify({"message": "Defect updated", "defect": defect.to_dict()}), 200
