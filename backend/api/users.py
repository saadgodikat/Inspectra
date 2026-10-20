"""User management endpoints (quality-manager only)."""

from flask import Blueprint, jsonify, request
from backend.extensions import db
from backend.models.user import User
from backend.middleware.permissions import require_permission
from backend.middleware.errors import NotFoundError

users_bp = Blueprint("users", __name__, url_prefix="/api/users")


@users_bp.route("", methods=["GET"])
@require_permission("user.manage")
def list_users(current_user):
    """List all users (quality manager only)."""
    users = User.query.order_by(User.created_at.desc()).all()
    return jsonify({"users": [u.to_dict() for u in users]}), 200


@users_bp.route("/<int:user_id>", methods=["GET"])
@require_permission("user.manage")
def get_user(user_id, current_user):
    """Get a single user by ID."""
    user = db.session.get(User, user_id)
    if not user:
        raise NotFoundError("User not found")
    return jsonify({"user": user.to_dict()}), 200


@users_bp.route("/<int:user_id>/deactivate", methods=["POST"])
@require_permission("user.manage")
def deactivate_user(user_id, current_user):
    """Deactivate a user account."""
    user = db.session.get(User, user_id)
    if not user:
        raise NotFoundError("User not found")
    if user.id == current_user.id:
        return jsonify({"error": "Cannot deactivate your own account"}), 400
    user.is_active = False
    db.session.commit()
    return jsonify({"user": user.to_dict(), "message": "User deactivated"}), 200


@users_bp.route("/<int:user_id>/activate", methods=["POST"])
@require_permission("user.manage")
def activate_user(user_id, current_user):
    """Reactivate a user account."""
    user = db.session.get(User, user_id)
    if not user:
        raise NotFoundError("User not found")
    user.is_active = True
    db.session.commit()
    return jsonify({"user": user.to_dict(), "message": "User activated"}), 200
