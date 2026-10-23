"""Confirmed defect model."""

import enum
from datetime import datetime, timezone
from backend.extensions import db


class DefectSeverity(str, enum.Enum):
    CRITICAL = "critical"
    MAJOR = "major"
    MINOR = "minor"
    COSMETIC = "cosmetic"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class DefectStatus(str, enum.Enum):
    OPEN = "open"
    IN_PROGRESS = "in_progress"
    RESOLVED = "resolved"
    CLOSED = "closed"
    REOPENED = "reopened"


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
        db.String(50), nullable=False, default=DefectSeverity.MAJOR.value
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
        import re

        conf = None
        item_number = None
        if self.description:
            match = re.search(r"confidence:\s*([0-9.]+)%", self.description)
            if match:
                try:
                    conf = float(match.group(1)) / 100.0
                except ValueError:
                    pass
            item_match = re.search(r"Item #(\d+)", self.description)
            if item_match:
                try:
                    item_number = int(item_match.group(1))
                except ValueError:
                    pass

        data = {
            "id": self.id,
            "defect_code": f"DEF-{self.id:04d}",
            "item_number": item_number,
            "item_tag": f"#{item_number:03d}" if item_number is not None else None,
            "inspection_id": self.inspection_id,
            "review_id": self.review_id,
            "defect_category": self.defect_category,
            "defect_type": self.defect_category.replace("_", " ").title(),
            "description": self.description,
            "severity": self.severity,
            "status": self.status,
            "created_by_id": self.created_by_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "confidence_score": conf,
            "location_x": None,
            "location_y": None,
        }
        if self.created_by:
            data["created_by"] = {
                "id": self.created_by.id,
                "name": self.created_by.name,
                "role": self.created_by.role,
            }
        if self.review:
            data["review"] = self.review.to_dict()
        try:
            data["corrective_actions"] = [a.to_dict() for a in self.corrective_actions.order_by(db.asc("id")).all()]
        except Exception:
            data["corrective_actions"] = []
        if self.inspection:
            data["inspection"] = {
                "id": self.inspection.id,
                "sample_reference": self.inspection.sample_reference,
                "product": {"name": self.inspection.product.name} if self.inspection.product else None,
                "batch": {"batch_number": self.inspection.batch.batch_number} if self.inspection.batch else None,
            }
        return data

    def __repr__(self):
        return f"<Defect {self.id} [{self.defect_category}] {self.severity}>"
