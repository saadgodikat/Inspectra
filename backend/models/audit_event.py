"""Audit event model for tracking important changes."""

from datetime import datetime, timezone
from backend.extensions import db


class AuditEvent(db.Model):
    __tablename__ = "audit_events"

    id = db.Column(db.Integer, primary_key=True)
    actor_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=True, index=True
    )
    action = db.Column(db.String(100), nullable=False, index=True)
    entity_type = db.Column(db.String(100), nullable=False, index=True)
    entity_id = db.Column(db.Integer, nullable=True, index=True)
    timestamp = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    details = db.Column(db.JSON, nullable=True)
    correlation_id = db.Column(db.String(100), nullable=True, index=True)

    # --- Relationships ---
    actor = db.relationship("User", foreign_keys=[actor_id])

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "actor_id": self.actor_id,
            "action": self.action,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "details": self.details,
            "correlation_id": self.correlation_id,
        }

    def __repr__(self):
        return f"<AuditEvent {self.id} {self.action} on {self.entity_type}:{self.entity_id}>"
