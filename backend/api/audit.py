"""Audit log API — immutable event log query (Quality Manager only)."""

from flask import Blueprint, jsonify, request
from sqlalchemy import desc

from backend.extensions import db
from backend.models.audit_event import AuditEvent
from backend.models.user import User
from backend.middleware.permissions import require_permission
from backend.middleware.errors import NotFoundError

audit_bp = Blueprint("audit", __name__, url_prefix="/api/audit")


@audit_bp.route("", methods=["GET"])
@require_permission("audit.view")
def list_audit_events(current_user):
    """List audit events with filters and pagination.

    Query params:
      - actor_id: integer
      - action: string (exact match)
      - entity_type: string
      - entity_id: integer
      - page, per_page
    """
    actor_id = request.args.get("actor_id", type=int)
    action = request.args.get("action", "").strip()
    entity_type = request.args.get("entity_type", "").strip()
    entity_id = request.args.get("entity_id", type=int)
    page = max(1, request.args.get("page", 1, type=int))
    per_page = min(100, max(1, request.args.get("per_page", 50, type=int)))

    query = AuditEvent.query

    if actor_id:
        query = query.filter_by(actor_id=actor_id)
    if action:
        query = query.filter_by(action=action)
    if entity_type:
        query = query.filter_by(entity_type=entity_type)
    if entity_id:
        query = query.filter_by(entity_id=entity_id)

    total = query.count()
    events = (
        query.order_by(desc(AuditEvent.timestamp))
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    # Enrich with actor name inline (avoids N+1 via simple join)
    actor_ids = {e.actor_id for e in events if e.actor_id}
    actors = {u.id: u.name for u in User.query.filter(User.id.in_(actor_ids)).all()} if actor_ids else {}

    results = []
    for e in events:
        d = e.to_dict()
        d["actor_name"] = actors.get(e.actor_id)
        results.append(d)

    return jsonify({
        "events": results,
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total + per_page - 1) // per_page),
    }), 200


@audit_bp.route("/<int:event_id>", methods=["GET"])
@require_permission("audit.view")
def get_audit_event(event_id, current_user):
    event = db.session.get(AuditEvent, event_id)
    if not event:
        raise NotFoundError("Audit event not found")

    d = event.to_dict()
    if event.actor:
        d["actor_name"] = event.actor.name
    return jsonify({"event": d}), 200
