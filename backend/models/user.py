"""User model with role-based access control."""

import enum
from datetime import datetime, timezone

import bcrypt
from backend.extensions import db


class UserRole(str, enum.Enum):
    """Application roles — stored as string in the database."""

    INSPECTOR = "inspector"
    SUPERVISOR = "supervisor"
    QUALITY_MANAGER = "quality_manager"


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(
        db.String(50),
        nullable=False,
        default=UserRole.INSPECTOR.value,
    )
    is_active = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # --- Relationships ---
    inspections = db.relationship(
        "Inspection", back_populates="inspector", foreign_keys="Inspection.inspector_id"
    )
    reviews = db.relationship("HumanReview", back_populates="reviewer")
    batch_decisions = db.relationship("BatchDecision", back_populates="decided_by_user")

    # --- Password helpers ---
    def set_password(self, password: str) -> None:
        self.password_hash = bcrypt.hashpw(
            password.encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")

    def check_password(self, password: str) -> bool:
        return bcrypt.checkpw(
            password.encode("utf-8"), self.password_hash.encode("utf-8")
        )

    # --- Serialisation ---
    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "role": self.role,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<User {self.email} ({self.role})>"
