"""Corrective actions API — CAPA lifecycle and repair evidence upload."""

import os
import uuid
from datetime import date

from flask import Blueprint, jsonify, request

from backend.extensions import db
from backend.models.corrective_action import CorrectiveAction, ActionStatus
from backend.models.corrective_action_evidence import CorrectiveActionEvidence
from backend.models.defect import Defect
from backend.middleware.permissions import require_permission
from backend.middleware.errors import NotFoundError, ValidationError
from backend.services.audit_service import log_audit_event
from backend.services.file_service import get_upload_base_dir

corrective_actions_bp = Blueprint(
    "corrective_actions", __name__, url_prefix="/api/corrective-actions"
)

VALID_STATUSES = {s.value for s in ActionStatus}


@corrective_actions_bp.route("", methods=["GET"])
@require_permission("corrective_action.view")
def list_corrective_actions(current_user):
    """List corrective actions with optional filters.

    Query params: defect_id, owner_id, status, page, per_page
    """
    defect_id = request.args.get("defect_id", type=int)
    owner_id = request.args.get("owner_id", type=int)
    status = request.args.get("status", "").strip().lower()
    page = max(1, request.args.get("page", 1, type=int))
    per_page = min(100, max(1, request.args.get("per_page", 20, type=int)))

    query = CorrectiveAction.query

    if defect_id:
        query = query.filter_by(defect_id=defect_id)
    if owner_id:
        query = query.filter_by(owner_id=owner_id)
    if status and status != "all":
        query = query.filter_by(status=status)

    total = query.count()
    actions = (
        query.order_by(CorrectiveAction.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return jsonify({
        "corrective_actions": [a.to_dict() for a in actions],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total + per_page - 1) // per_page),
    }), 200


@corrective_actions_bp.route("/<int:action_id>", methods=["GET"])
@require_permission("corrective_action.view")
def get_corrective_action(action_id, current_user):
    action = db.session.get(CorrectiveAction, action_id)
    if not action:
        raise NotFoundError("Corrective action not found")

    data = action.to_dict()
    data["evidence"] = [e.to_dict() for e in action.evidence.order_by(CorrectiveActionEvidence.submitted_at.asc()).all()]
    return jsonify({"corrective_action": data}), 200


@corrective_actions_bp.route("", methods=["POST"])
@require_permission("corrective_action.create")
def create_corrective_action(current_user):
    """Create a CAPA for a defect (Supervisor & Quality Manager).

    Body: { defect_id, notes?, target_date?, owner_id? }
    """
    data = request.get_json(silent=True)
    if not data:
        raise ValidationError("JSON body required")

    defect_id = data.get("defect_id")
    notes = (data.get("notes") or "").strip() or None
    target_date_raw = data.get("target_date")
    owner_id = data.get("owner_id") or current_user.id

    errors: dict[str, str] = {}

    if not defect_id:
        errors["defect_id"] = "Defect ID is required"
    else:
        defect = db.session.get(Defect, defect_id)
        if not defect:
            errors["defect_id"] = f"Defect {defect_id} not found"

    parsed_date = None
    if target_date_raw:
        try:
            parsed_date = date.fromisoformat(target_date_raw)
        except ValueError:
            errors["target_date"] = "target_date must be YYYY-MM-DD"

    if errors:
        raise ValidationError("Validation failed", details=errors)

    action = CorrectiveAction(
        defect_id=defect_id,
        owner_id=owner_id,
        notes=notes,
        target_date=parsed_date,
        status=ActionStatus.OPEN.value,
    )
    db.session.add(action)
    db.session.flush()

    log_audit_event(
        actor_id=current_user.id,
        action="corrective_action.create",
        entity_type="corrective_action",
        entity_id=action.id,
        details={"defect_id": defect_id, "owner_id": owner_id},
    )
    db.session.commit()

    return jsonify({"message": "Corrective action created", "corrective_action": action.to_dict()}), 201


@corrective_actions_bp.route("/<int:action_id>", methods=["PATCH"])
@require_permission("corrective_action.update")
def update_corrective_action(action_id, current_user):
    """Update CAPA notes, status, target_date, or completion_notes."""
    action = db.session.get(CorrectiveAction, action_id)
    if not action:
        raise NotFoundError("Corrective action not found")

    data = request.get_json(silent=True)
    if not data:
        raise ValidationError("JSON body required")

    changes = {}

    if "status" in data:
        st = (data["status"] or "").strip().lower()
        if st not in VALID_STATUSES:
            raise ValidationError(f"Status must be one of: {', '.join(sorted(VALID_STATUSES))}")
        if st != action.status:
            changes["status"] = {"from": action.status, "to": st}
            action.status = st

    if "notes" in data:
        val = (data["notes"] or "").strip() or None
        changes["notes"] = {"from": action.notes, "to": val}
        action.notes = val

    if "completion_notes" in data:
        val = (data["completion_notes"] or "").strip() or None
        changes["completion_notes"] = {"from": action.completion_notes, "to": val}
        action.completion_notes = val

    if "target_date" in data:
        raw = data["target_date"]
        if raw is None or raw == "":
            action.target_date = None
        else:
            try:
                action.target_date = date.fromisoformat(raw)
            except ValueError:
                raise ValidationError("target_date must be YYYY-MM-DD")

    if changes:
        log_audit_event(
            actor_id=current_user.id,
            action="corrective_action.update",
            entity_type="corrective_action",
            entity_id=action.id,
            details=changes,
        )
        db.session.commit()

    return jsonify({"message": "Corrective action updated", "corrective_action": action.to_dict()}), 200


@corrective_actions_bp.route("/<int:action_id>/evidence", methods=["POST"])
@require_permission("corrective_action.submit_evidence")
def submit_evidence(action_id, current_user):
    """Submit repair evidence for a corrective action.

    Accepts multipart/form-data:
      - file (optional image)
      - description (text)
      - notes (text)
    """
    action = db.session.get(CorrectiveAction, action_id)
    if not action:
        raise NotFoundError("Corrective action not found")

    description = (request.form.get("description") or "").strip() or None
    notes = (request.form.get("notes") or "").strip() or None

    file_path = None
    original_filename = None

    if "file" in request.files:
        f = request.files["file"]
        if f and f.filename:
            from werkzeug.utils import secure_filename
            safe_name = secure_filename(os.path.basename(f.filename))
            storage_uuid = uuid.uuid4().hex
            ext = os.path.splitext(safe_name)[1].lower()
            relative_path = os.path.join("capa_evidence", str(action_id), f"{storage_uuid}{ext}")
            base_dir = get_upload_base_dir()
            abs_path = os.path.join(base_dir, relative_path)

            if not os.path.abspath(abs_path).startswith(os.path.abspath(base_dir)):
                raise ValidationError("Invalid file path")

            os.makedirs(os.path.dirname(abs_path), exist_ok=True)
            f.save(abs_path)
            file_path = relative_path
            original_filename = safe_name

    evidence = CorrectiveActionEvidence(
        corrective_action_id=action_id,
        submitted_by_id=current_user.id,
        file_path=file_path,
        original_filename=original_filename,
        description=description,
        notes=notes,
    )
    db.session.add(evidence)
    db.session.flush()

    # Auto-advance action to in_progress if still open
    if action.status == ActionStatus.OPEN.value:
        action.status = ActionStatus.IN_PROGRESS.value

    log_audit_event(
        actor_id=current_user.id,
        action="corrective_action.evidence_submitted",
        entity_type="corrective_action_evidence",
        entity_id=evidence.id,
        details={"corrective_action_id": action_id, "has_file": file_path is not None},
    )
    db.session.commit()

    return jsonify({"message": "Evidence submitted", "evidence": evidence.to_dict()}), 201
