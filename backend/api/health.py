"""Health-check endpoint."""

from flask import Blueprint, jsonify
from backend.extensions import db

health_bp = Blueprint("health", __name__)


@health_bp.route("/api/health", methods=["GET"])
def health_check():
    """Return application and database health status."""
    db_ok = False
    try:
        db.session.execute(db.text("SELECT 1"))
        db_ok = True
    except Exception:
        pass

    status = "healthy" if db_ok else "degraded"
    code = 200 if db_ok else 503

    return jsonify({
        "status": status,
        "database": "connected" if db_ok else "disconnected",
    }), code
