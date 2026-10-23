"""Human review model."""

import enum
from datetime import datetime, timezone
from backend.extensions import db


class ReviewDecision(str, enum.Enum):
    CONFIRM = "confirm"        # Agrees with ML suggestion
    CORRECT = "correct"        # Disagrees — provides corrected label
    NO_DEFECT = "no_defect"    # No defect found
    NEEDS_MORE_EVIDENCE = "needs_more_evidence"


class HumanReview(db.Model):
    __tablename__ = "human_reviews"

    id = db.Column(db.Integer, primary_key=True)
    inspection_id = db.Column(
        db.Integer, db.ForeignKey("inspections.id"), nullable=False, index=True
    )
    ml_result_id = db.Column(
        db.Integer, db.ForeignKey("ml_results.id"), nullable=True, index=True
    )
    reviewer_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    decision = db.Column(db.String(50), nullable=False)
    confirmed_class = db.Column(db.String(100), nullable=True)
    comments = db.Column(db.Text, nullable=True)
    review_timestamp = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # --- Relationships ---
    inspection = db.relationship("Inspection", back_populates="reviews")
    ml_result = db.relationship("MLResult")
    reviewer = db.relationship("User", back_populates="reviews")

    def to_dict(self) -> dict:
        data = {
            "id": self.id,
            "inspection_id": self.inspection_id,
            "ml_result_id": self.ml_result_id,
            "reviewer_id": self.reviewer_id,
            "decision": self.decision,
            "confirmed_class": self.confirmed_class,
            "comments": self.comments,
            "review_timestamp": (
                self.review_timestamp.isoformat() if self.review_timestamp else None
            ),
        }
        if self.reviewer:
            data["reviewer"] = {
                "id": self.reviewer.id,
                "name": self.reviewer.name,
                "email": self.reviewer.email,
                "role": self.reviewer.role,
            }
        return data

    def __repr__(self):
        return f"<HumanReview {self.id} [{self.decision}]>"
