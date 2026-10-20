"""Confirmed defect model."""

import enum
from datetime import datetime, timezone
from backend.extensions import db


class DefectSeverity(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class DefectStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"


class Defect(db.Model):
    __tablename__ = "defects"

    id = db.Column(db.Integer, primary_key=True)
    inspection_id = db.Column(
        db.Integer, db.ForeignKey("inspections.id"), nullable=False, index=True
    )
    review_id = db.Column(
        db.Integer, db.ForeignKey("human_reviews.id"), nullable=True, index=True
    )
    defect_category = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    severity = db.Column(
        db.String(50), nullable=False, default=DefectSeverity.MEDIUM.value
    )
    status = db.Column(
        db.String(50), nullable=False, default=DefectStatus.OPEN.value
    )
    created_by_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False
    )
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
    inspection = db.relationship("Inspection", back_populates="defects")
    review = db.relationship("HumanReview")
    created_by = db.relationship("User", foreign_keys=[created_by_id])
    corrective_actions = db.relationship(
        "CorrectiveAction", back_populates="defect", lazy="dynamic"
    )

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "inspection_id": self.inspection_id,
            "review_id": self.review_id,
            "defect_category": self.defect_category,
            "description": self.description,
            "severity": self.severity,
            "status": self.status,
            "created_by_id": self.created_by_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<Defect {self.id} [{self.defect_category}] {self.severity}>"
