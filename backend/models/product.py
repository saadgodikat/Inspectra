"""Product model."""

from datetime import datetime, timezone
from backend.extensions import db


class Product(db.Model):
    __tablename__ = "products"

    id = db.Column(db.Integer, primary_key=True)
    product_code = db.Column(db.String(100), unique=True, nullable=False, index=True)
    name = db.Column(db.String(255), nullable=False)
    category = db.Column(db.String(100), nullable=True)
    description = db.Column(db.Text, nullable=True)
    is_active = db.Column(db.Boolean, default=True, nullable=False)
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
    batches = db.relationship("Batch", back_populates="product", lazy="dynamic")
    inspections = db.relationship("Inspection", back_populates="product", lazy="dynamic")

    def to_dict(self, include_counts: bool = False) -> dict:
        data = {
            "id": self.id,
            "product_code": self.product_code,
            "name": self.name,
            "category": self.category,
            "description": self.description,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_counts:
            data["batch_count"] = self.batches.count()
            data["inspection_count"] = self.inspections.count()
        return data

    def __repr__(self):
        return f"<Product {self.product_code}>"
