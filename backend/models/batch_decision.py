"""Batch decision model — separate from individual inspection outcomes."""

from datetime import datetime, timezone
from backend.extensions import db


class BatchDecision(db.Model):
    __tablename__ = "batch_decisions"

    id = db.Column(db.Integer, primary_key=True)
    batch_id = db.Column(
        db.Integer, db.ForeignKey("batches.id"), nullable=False, index=True
    )
    decision = db.Column(db.String(50), nullable=False)  # "hold" or "release"
    reason = db.Column(db.Text, nullable=False)
    decided_by_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False
    )
    decision_timestamp = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # Snapshot counts at decision time
    total_inspected = db.Column(db.Integer, nullable=True)
    total_reviewed = db.Column(db.Integer, nullable=True)
    total_confirmed_defects = db.Column(db.Integer, nullable=True)

    # --- Relationships ---
    batch = db.relationship("Batch", back_populates="decisions")
    decided_by_user = db.relationship("User", back_populates="batch_decisions")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "batch_id": self.batch_id,
            "decision": self.decision,
            "reason": self.reason,
            "decided_by_id": self.decided_by_id,
            "decision_timestamp": (
                self.decision_timestamp.isoformat()
                if self.decision_timestamp
                else None
            ),
            "total_inspected": self.total_inspected,
            "total_reviewed": self.total_reviewed,
            "total_confirmed_defects": self.total_confirmed_defects,
        }

    def __repr__(self):
        return f"<BatchDecision {self.id} [{self.decision}]>"
