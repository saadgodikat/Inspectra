"""ML inference result model."""

import enum
from datetime import datetime, timezone
from backend.extensions import db


class MLResultStatus(str, enum.Enum):
    PENDING = "pending"
    SUCCESS = "success"
    FAILED = "failed"


class MLResult(db.Model):
    __tablename__ = "ml_results"

    id = db.Column(db.Integer, primary_key=True)
    inspection_id = db.Column(
        db.Integer, db.ForeignKey("inspections.id"), nullable=False, index=True
    )
    image_id = db.Column(
        db.Integer, db.ForeignKey("inspection_images.id"), nullable=True, index=True
    )
    predicted_class = db.Column(db.String(100), nullable=True)
    model_name = db.Column(db.String(200), nullable=False)
    model_version = db.Column(db.String(50), nullable=False)
    raw_scores = db.Column(db.JSON, nullable=True)  # {class: score}
    processing_duration_ms = db.Column(db.Integer, nullable=True)
    status = db.Column(
        db.String(50), nullable=False, default=MLResultStatus.PENDING.value
    )
    error_details = db.Column(db.Text, nullable=True)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # --- Relationships ---
    inspection = db.relationship("Inspection", back_populates="ml_results")
    image = db.relationship("InspectionImage", back_populates="ml_results")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "inspection_id": self.inspection_id,
            "image_id": self.image_id,
            "predicted_class": self.predicted_class,
            "model_name": self.model_name,
            "model_version": self.model_version,
            "raw_scores": self.raw_scores,
            "processing_duration_ms": self.processing_duration_ms,
            "status": self.status,
            "error_details": self.error_details,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<MLResult {self.id} [{self.status}] -> {self.predicted_class}>"
