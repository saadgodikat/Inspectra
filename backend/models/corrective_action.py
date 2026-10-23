"""Corrective action model."""

import enum
from datetime import datetime, timezone
from backend.extensions import db


class ActionStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CLOSED = "closed"
    REOPENED = "reopened"


class CorrectiveAction(db.Model):
    __tablename__ = "corrective_actions"

    id = db.Column(db.Integer, primary_key=True)
    defect_id = db.Column(
        db.Integer, db.ForeignKey("defects.id"), nullable=False, index=True
    )
    owner_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    target_date = db.Column(db.Date, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    status = db.Column(
        db.String(50), nullable=False, default=ActionStatus.OPEN.value
    )
    completion_notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at = db.Column(
        db.DateTime,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # --- Relationships ---
    defect = db.relationship("Defect", back_populates="corrective_actions")
    owner = db.relationship("User", foreign_keys=[owner_id])
    evidence = db.relationship(
        "CorrectiveActionEvidence", back_populates="corrective_action", lazy="dynamic"
    )

    def to_dict(self) -> dict:
        data = {
            "id": self.id,
            "defect_id": self.defect_id,
            "owner_id": self.owner_id,
            "target_date": (
                self.target_date.isoformat() if self.target_date else None
            ),
            "notes": self.notes,
            "status": self.status,
            "completion_notes": self.completion_notes,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if self.owner:
            data["owner"] = {
                "id": self.owner.id,
                "name": self.owner.name,
                "email": self.owner.email,
                "role": self.owner.role,
            }
        try:
            data["evidence_count"] = self.evidence.count()
        except Exception:
            data["evidence_count"] = 0
        return data

    def __repr__(self):
        return f"<CorrectiveAction {self.id} [{self.status}]>"
