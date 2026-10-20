"""Batch model."""

import enum
from datetime import datetime, timezone
from backend.extensions import db


class BatchStatus(str, enum.Enum):
    CREATED = "created"
    IN_PRODUCTION = "in_production"
    PRODUCED = "produced"
    UNDER_INSPECTION = "under_inspection"
    ON_HOLD = "on_hold"
    RELEASED = "released"
    ARCHIVED = "archived"


class Batch(db.Model):
    __tablename__ = "batches"

    id = db.Column(db.Integer, primary_key=True)
    batch_number = db.Column(db.String(100), unique=True, nullable=False, index=True)
    product_id = db.Column(
        db.Integer, db.ForeignKey("products.id"), nullable=False, index=True
    )
    production_date = db.Column(db.Date, nullable=True)
    quantity = db.Column(db.Integer, nullable=True)
    status = db.Column(
        db.String(50), nullable=False, default=BatchStatus.CREATED.value
    )
    production_line = db.Column(db.String(100), nullable=True)
    supplier = db.Column(db.String(255), nullable=True)
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
    product = db.relationship("Product", back_populates="batches")
    inspections = db.relationship("Inspection", back_populates="batch", lazy="dynamic")
    decisions = db.relationship("BatchDecision", back_populates="batch", lazy="dynamic")

    def to_dict(self, include_product: bool = False) -> dict:
        data = {
            "id": self.id,
            "batch_number": self.batch_number,
            "product_id": self.product_id,
            "production_date": (
                self.production_date.isoformat() if self.production_date else None
            ),
            "quantity": self.quantity,
            "status": self.status,
            "production_line": self.production_line,
            "supplier": self.supplier,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_product and self.product:
            data["product"] = {
                "id": self.product.id,
                "product_code": self.product.product_code,
                "name": self.product.name,
                "category": self.product.category,
                "is_active": self.product.is_active,
            }
        return data

    def __repr__(self):
        return f"<Batch {self.batch_number}>"
