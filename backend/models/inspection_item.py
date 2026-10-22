"""InspectionItem model — one row per allocated item slot in a batch inspection run."""

from datetime import datetime, timezone
from backend.extensions import db


class ItemStatus:
    PENDING_UPLOAD = "pending_upload"
    UPLOADED = "uploaded"
    ANALYZED = "analyzed"


class InspectionItem(db.Model):
    __tablename__ = "inspection_items"

    id = db.Column(db.Integer, primary_key=True)
    inspection_id = db.Column(
        db.Integer, db.ForeignKey("inspections.id"), nullable=False, index=True
    )
    item_number = db.Column(db.Integer, nullable=False)  # e.g. 59
    status = db.Column(db.String(50), nullable=False, default=ItemStatus.PENDING_UPLOAD)
    image_id = db.Column(
        db.Integer, db.ForeignKey("inspection_images.id"), nullable=True
    )
    ml_result_id = db.Column(
        db.Integer, db.ForeignKey("ml_results.id"), nullable=True
    )
    # Supervisor override
    override_decision = db.Column(db.String(50), nullable=True)  # "good" | "defective"
    override_comment = db.Column(db.Text, nullable=True)
    override_by_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=True
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
    inspection = db.relationship("Inspection", back_populates="items")
    image = db.relationship("InspectionImage", foreign_keys=[image_id])
    ml_result = db.relationship("MLResult", foreign_keys=[ml_result_id])
    override_by = db.relationship("User", foreign_keys=[override_by_id])

    __table_args__ = (
        db.UniqueConstraint("inspection_id", "item_number", name="uq_inspection_item_number"),
    )

    def effective_decision(self):
        """Return override if set, else ML predicted class."""
        if self.override_decision:
            return self.override_decision
        if self.ml_result:
            return self.ml_result.predicted_class
        return None

    def to_dict(self, include_image_url: bool = False) -> dict:
        data = {
            "id": self.id,
            "inspection_id": self.inspection_id,
            "item_number": self.item_number,
            "status": self.status,
            "image_id": self.image_id,
            "ml_result_id": self.ml_result_id,
            "override_decision": self.override_decision,
            "override_comment": self.override_comment,
            "override_by_id": self.override_by_id,
            "effective_decision": self.effective_decision(),
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if self.ml_result:
            data["ml_result"] = self.ml_result.to_dict()
        if self.image:
            data["image"] = {
                "id": self.image.id,
                "original_filename": self.image.original_filename,
                "content_type": self.image.content_type,
                "file_size": self.image.file_size,
                "upload_timestamp": self.image.upload_timestamp.isoformat() if self.image.upload_timestamp else None,
            }
        return data

    def __repr__(self):
        return f"<InspectionItem inspection={self.inspection_id} item={self.item_number} [{self.status}]>"
