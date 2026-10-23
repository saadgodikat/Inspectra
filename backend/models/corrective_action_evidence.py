"""Corrective action evidence (repair/fix evidence submitted by supervisors)."""

from datetime import datetime, timezone
from backend.extensions import db


class CorrectiveActionEvidence(db.Model):
    __tablename__ = "corrective_action_evidence"

    id = db.Column(db.Integer, primary_key=True)
    corrective_action_id = db.Column(
        db.Integer,
        db.ForeignKey("corrective_actions.id"),
        nullable=False,
        index=True,
    )
    submitted_by_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False
    )
    file_path = db.Column(db.String(500), nullable=True)
    original_filename = db.Column(db.String(255), nullable=True)
    description = db.Column(db.Text, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    submitted_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # --- Relationships ---
    corrective_action = db.relationship(
        "CorrectiveAction", back_populates="evidence"
    )
    submitted_by = db.relationship("User", foreign_keys=[submitted_by_id])

    def to_dict(self) -> dict:
        data = {
            "id": self.id,
            "corrective_action_id": self.corrective_action_id,
            "submitted_by_id": self.submitted_by_id,
            "original_filename": self.original_filename,
            "file_path": self.file_path,
            "has_file": bool(self.file_path),
            "description": self.description,
            "notes": self.notes,
            "submitted_at": (
                self.submitted_at.isoformat() if self.submitted_at else None
            ),
        }
        if self.submitted_by:
            data["submitted_by"] = {
                "id": self.submitted_by.id,
                "name": self.submitted_by.name,
                "email": self.submitted_by.email,
                "role": self.submitted_by.role,
            }
        return data

    def __repr__(self):
        return f"<CorrectiveActionEvidence {self.id}>"
