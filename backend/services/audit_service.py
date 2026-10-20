"""Audit service — records important changes to the audit log."""

from backend.extensions import db
from backend.models.audit_event import AuditEvent


def log_audit_event(
    actor_id: int | None,
    action: str,
    entity_type: str,
    entity_id: int | None = None,
    details: dict | None = None,
    correlation_id: str | None = None,
) -> AuditEvent:
    """Create and persist an audit event."""
    event = AuditEvent(
        actor_id=actor_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        details=details,
        correlation_id=correlation_id,
    )
    db.session.add(event)
    # Do not commit here — let the caller control the transaction boundary.
    return event
