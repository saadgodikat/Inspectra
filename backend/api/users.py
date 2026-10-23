"""User management endpoints (quality-manager only)."""

from flask import Blueprint, jsonify, request
from backend.extensions import db
from backend.models.user import User, UserRole
from backend.middleware.permissions import require_permission
from backend.middleware.errors import NotFoundError, ValidationError
from backend.services.audit_service import log_audit_event

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
    log_audit_event(
        actor_id=current_user.id,
        action="user.deactivate",
        entity_type="user",
        entity_id=user.id,
        details={"email": user.email, "role": user.role},
    )
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
    log_audit_event(
        actor_id=current_user.id,
        action="user.activate",
        entity_type="user",
        entity_id=user.id,
        details={"email": user.email, "role": user.role},
    )
    db.session.commit()
    return jsonify({"user": user.to_dict(), "message": "User activated"}), 200


@users_bp.route("/<int:user_id>/role", methods=["PATCH"])
@require_permission("user.manage")
def update_user_role(user_id, current_user):
    """Change a user's role (Quality Manager only)."""
    user = db.session.get(User, user_id)
    if not user:
        raise NotFoundError("User not found")
    if user.id == current_user.id:
        return jsonify({"error": "Cannot change your own role"}), 400

    data = request.get_json(silent=True)
    if not data:
        raise ValidationError("JSON body required")

    new_role = (data.get("role") or "").strip().lower()
    valid_roles = {r.value for r in UserRole}
    if new_role not in valid_roles:
        raise ValidationError(f"Role must be one of: {', '.join(sorted(valid_roles))}")

    old_role = user.role
    user.role = new_role
    log_audit_event(
        actor_id=current_user.id,
        action="user.role_change",
        entity_type="user",
        entity_id=user.id,
        details={"email": user.email, "from": old_role, "to": new_role},
    )
    db.session.commit()
    return jsonify({"user": user.to_dict(), "message": "Role updated"}), 200


@users_bp.route("/assignable", methods=["GET"])
@require_permission("corrective_action.view")
def list_assignable_users(current_user):
    """List active users eligible for CAPA assignment."""
    users = User.query.filter_by(is_active=True).order_by(User.name.asc()).all()
    return jsonify({"users": [u.to_dict() for u in users]}), 200

