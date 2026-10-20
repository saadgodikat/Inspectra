"""Inspection model."""

import enum
from datetime import datetime, timezone
from backend.extensions import db


class InspectionStatus(str, enum.Enum):
    PENDING_UPLOAD = "pending_upload"
    PROCESSING = "processing"
    PENDING_REVIEW = "pending_review"
    REVIEWED = "reviewed"
    NEEDS_MORE_EVIDENCE = "needs_more_evidence"
    PROCESSING_FAILED = "processing_failed"


class SampleType(str, enum.Enum):
    ITEM = "item"
    SURFACE = "surface"
    BATCH_SAMPLE = "batch_sample"


class Inspection(db.Model):
    __tablename__ = "inspections"

    id = db.Column(db.Integer, primary_key=True)
    product_id = db.Column(
        db.Integer, db.ForeignKey("products.id"), nullable=False, index=True
    )
    batch_id = db.Column(
        db.Integer, db.ForeignKey("batches.id"), nullable=False, index=True
    )
    inspector_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    sample_reference = db.Column(db.String(200), nullable=True)
    sample_type = db.Column(
        db.String(50), nullable=False, default=SampleType.ITEM.value
    )
    observations = db.Column(db.Text, nullable=True)
    status = db.Column(
        db.String(50),
        nullable=False,
        default=InspectionStatus.PENDING_UPLOAD.value,
    )
    inspection_timestamp = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    # Self-referencing FK for reinspections
    reinspection_of_id = db.Column(
        db.Integer, db.ForeignKey("inspections.id"), nullable=True, index=True
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
    product = db.relationship("Product", back_populates="inspections")
    batch = db.relationship("Batch", back_populates="inspections")
    inspector = db.relationship(
        "User", back_populates="inspections", foreign_keys=[inspector_id]
    )
    images = db.relationship(
        "InspectionImage", back_populates="inspection", lazy="dynamic"
    )
    ml_results = db.relationship("MLResult", back_populates="inspection", lazy="dynamic")
    reviews = db.relationship(
        "HumanReview", back_populates="inspection", lazy="dynamic"
    )
    defects = db.relationship("Defect", back_populates="inspection", lazy="dynamic")

    # Reinspection chain
    reinspection_of = db.relationship(
        "Inspection", remote_side="Inspection.id", backref="reinspections"
    )

    def to_dict(self, include_details: bool = False) -> dict:
        data = {
            "id": self.id,
            "product_id": self.product_id,
            "batch_id": self.batch_id,
            "inspector_id": self.inspector_id,
            "sample_reference": self.sample_reference,
            "sample_type": self.sample_type,
            "observations": self.observations,
            "status": self.status,
            "inspection_timestamp": (
                self.inspection_timestamp.isoformat()
                if self.inspection_timestamp
                else None
            ),
            "reinspection_of_id": self.reinspection_of_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "image_count": self.images.count(),
        }
        if include_details:
            if self.product:
                data["product"] = {
                    "id": self.product.id,
                    "product_code": self.product.product_code,
                    "name": self.product.name,
                    "category": self.product.category,
                    "is_active": self.product.is_active,
                }
            if self.batch:
                data["batch"] = {
                    "id": self.batch.id,
                    "batch_number": self.batch.batch_number,
                    "status": self.batch.status,
                    "production_date": (
                        self.batch.production_date.isoformat()
                        if self.batch.production_date
                        else None
                    ),
                    "quantity": self.batch.quantity,
                    "production_line": self.batch.production_line,
                    "supplier": self.batch.supplier,
                }
            if self.inspector:
                data["inspector"] = {
                    "id": self.inspector.id,
                    "name": self.inspector.name,
                    "email": self.inspector.email,
                    "role": self.inspector.role,
                }
            data["images"] = [img.to_dict() for img in self.images.order_by(db.asc("id")).all()]
        return data

    def __repr__(self):
        return f"<Inspection {self.id} [{self.status}]>"
