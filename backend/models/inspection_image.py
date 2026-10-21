"""Inspection image / evidence model."""

import enum
from datetime import datetime, timezone
from backend.extensions import db


class ImageProcessingState(str, enum.Enum):
    UPLOADED = "uploaded"
    PROCESSING = "processing"
    PROCESSED = "processed"
    FAILED = "failed"


class InspectionImage(db.Model):
    __tablename__ = "inspection_images"

    id = db.Column(db.Integer, primary_key=True)
    inspection_id = db.Column(
        db.Integer, db.ForeignKey("inspections.id"), nullable=False, index=True
    )
    storage_path = db.Column(db.String(500), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    content_type = db.Column(db.String(100), nullable=False)
    file_size = db.Column(db.Integer, nullable=False)
    file_hash = db.Column(db.String(128), nullable=False)  # SHA-256
    sample_type = db.Column(db.String(50), nullable=True)
    uploaded_by_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False
    )
    upload_timestamp = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    processing_state = db.Column(
        db.String(50),
        nullable=False,
        default=ImageProcessingState.UPLOADED.value,
    )
    failure_reason = db.Column(db.Text, nullable=True)

    # --- Relationships ---
    inspection = db.relationship("Inspection", back_populates="images")
    uploaded_by = db.relationship("User", foreign_keys=[uploaded_by_id])
    ml_results = db.relationship("MLResult", back_populates="image", lazy="dynamic")

    def to_dict(self, include_ml: bool = True) -> dict:
        data = {
            "id": self.id,
            "inspection_id": self.inspection_id,
            "original_filename": self.original_filename,
            "content_type": self.content_type,
            "file_size": self.file_size,
            "file_hash": self.file_hash,
            "sample_type": self.sample_type,
            "uploaded_by_id": self.uploaded_by_id,
            "upload_timestamp": (
                self.upload_timestamp.isoformat() if self.upload_timestamp else None
            ),
            "processing_state": self.processing_state,
            "failure_reason": self.failure_reason,
        }
        if include_ml:
            try:
                if self.ml_results is not None:
                    latest = self.ml_results.order_by(db.desc("id")).first()
                    data["ml_result"] = latest.to_dict() if latest else None
            except Exception:
                data["ml_result"] = None
        return data

    def __repr__(self):
        return f"<InspectionImage {self.id} [{self.processing_state}]>"
