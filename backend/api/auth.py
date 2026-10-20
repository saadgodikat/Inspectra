"""Authentication endpoints — login, register, refresh, me."""

from flask import Blueprint, jsonify, request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    get_jwt_identity,
    jwt_required,
)

from backend.extensions import db
from backend.models.user import User, UserRole
from backend.middleware.errors import APIError, ValidationError

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")


@auth_bp.route("/register", methods=["POST"])
def register():
    """Create a new user account.

    Body: { name, email, password, role? }
    Default role is 'inspector'.
    """
    data = request.get_json(silent=True)
    if not data:
        raise ValidationError("JSON body required")

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    role = (data.get("role") or UserRole.INSPECTOR.value).strip().lower()

    # --- Validation ---
    errors: dict[str, str] = {}
    if not name:
        errors["name"] = "Name is required"
    if not email or "@" not in email:
        errors["email"] = "Valid email is required"
    if len(password) < 8:
        errors["password"] = "Password must be at least 8 characters"
    valid_roles = {r.value for r in UserRole}
    if role not in valid_roles:
        errors["role"] = f"Role must be one of: {', '.join(sorted(valid_roles))}"

    if errors:
        raise ValidationError("Validation failed", details=errors)

    if User.query.filter_by(email=email).first():
        raise APIError("Email already registered", 409)

    user = User(name=name, email=email, role=role)
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    return jsonify({
        "message": "User registered successfully",
        "user": user.to_dict(),
        "access_token": access_token,
        "refresh_token": refresh_token,
    }), 201


@auth_bp.route("/login", methods=["POST"])
def login():
    """Authenticate user and return JWT tokens.

    Body: { email, password }
    """
    data = request.get_json(silent=True)
    if not data:
        raise ValidationError("JSON body required")

    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""

    if not email or not password:
        raise ValidationError("Email and password are required")

    user = User.query.filter_by(email=email).first()
    if user is None or not user.check_password(password):
        raise APIError("Invalid email or password", 401)

    if not user.is_active:
        raise APIError("Account is deactivated", 403)

    access_token = create_access_token(identity=str(user.id))
    refresh_token = create_refresh_token(identity=str(user.id))

    return jsonify({
        "user": user.to_dict(),
        "access_token": access_token,
        "refresh_token": refresh_token,
    }), 200


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    """Return a new access token from a valid refresh token."""
    identity = get_jwt_identity()
    access_token = create_access_token(identity=identity)
    return jsonify({"access_token": access_token}), 200


@auth_bp.route("/me", methods=["GET"])
@jwt_required()
def me():
    """Return the current authenticated user's profile."""
    user_id = get_jwt_identity()
    user = db.session.get(User, int(user_id))
    if user is None:
        raise APIError("User not found", 404)
    return jsonify({"user": user.to_dict()}), 200
