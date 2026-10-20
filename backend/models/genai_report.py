"""GenAI report model — stores generated summaries with citations."""

from datetime import datetime, timezone
from backend.extensions import db


class GenAIReport(db.Model):
    __tablename__ = "genai_reports"

    id = db.Column(db.Integer, primary_key=True)
    requested_by_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, index=True
    )
    question = db.Column(db.Text, nullable=False)
    summary_type = db.Column(db.String(100), nullable=True)
    filters = db.Column(db.JSON, nullable=True)
    response = db.Column(db.Text, nullable=True)
    model_name = db.Column(db.String(200), nullable=True)
    cited_records = db.Column(db.JSON, nullable=True)  # [{type, id}, ...]
    created_at = db.Column(
        db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    # --- Relationships ---
    requested_by = db.relationship("User", foreign_keys=[requested_by_id])

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "requested_by_id": self.requested_by_id,
            "question": self.question,
            "summary_type": self.summary_type,
            "filters": self.filters,
            "response": self.response,
            "model_name": self.model_name,
            "cited_records": self.cited_records,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }

    def __repr__(self):
        return f"<GenAIReport {self.id}>"
