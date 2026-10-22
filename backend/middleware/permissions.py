"""Role-based permission enforcement.

Permission matrix — defines which roles can perform which actions.
Enforced server-side on every protected endpoint.
"""

from functools import wraps

from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request

from backend.extensions import db
from backend.models.user import User, UserRole
from backend.middleware.errors import ForbiddenError


# ------------------------------------------------------------------ #
# Permission matrix                                                    #
# ------------------------------------------------------------------ #
# Maps action names → set of allowed roles.
# Use `require_permission("action_name")` as a decorator.
# ------------------------------------------------------------------ #

PERMISSION_MATRIX: dict[str, set[str]] = {
    # --- Products & Batches ---
    "product.create": {UserRole.QUALITY_MANAGER.value},
    "product.edit": {UserRole.QUALITY_MANAGER.value},
    "product.archive": {UserRole.QUALITY_MANAGER.value},
    "product.view": {
        UserRole.INSPECTOR.value,
        UserRole.SUPERVISOR.value,
        UserRole.QUALITY_MANAGER.value,
    },
    "batch.create": {UserRole.QUALITY_MANAGER.value, UserRole.SUPERVISOR.value},
    "batch.edit": {UserRole.QUALITY_MANAGER.value, UserRole.SUPERVISOR.value},
    "batch.view": {
        UserRole.INSPECTOR.value,
        UserRole.SUPERVISOR.value,
        UserRole.QUALITY_MANAGER.value,
    },

    # --- Inspections ---
    "inspection.create": {
        UserRole.INSPECTOR.value,
        UserRole.SUPERVISOR.value,
        UserRole.QUALITY_MANAGER.value,
    },
    "inspection.view": {
        UserRole.INSPECTOR.value,
        UserRole.SUPERVISOR.value,
        UserRole.QUALITY_MANAGER.value,
    },
    "inspection.upload_image": {
        UserRole.INSPECTOR.value,
        UserRole.SUPERVISOR.value,
        UserRole.QUALITY_MANAGER.value,
    },
    "inspection_item.override": {
        UserRole.SUPERVISOR.value,
        UserRole.QUALITY_MANAGER.value,
    },

    # --- Reviews ---
    "review.create": {
        UserRole.INSPECTOR.value,
        UserRole.SUPERVISOR.value,
        UserRole.QUALITY_MANAGER.value,
    },
    "review.view": {
        UserRole.INSPECTOR.value,
        UserRole.SUPERVISOR.value,
        UserRole.QUALITY_MANAGER.value,
    },

    # --- Defects ---
    "defect.view": {
        UserRole.INSPECTOR.value,
        UserRole.SUPERVISOR.value,
        UserRole.QUALITY_MANAGER.value,
    },

    # --- Corrective Actions ---
    "corrective_action.create": {
        UserRole.SUPERVISOR.value,
        UserRole.QUALITY_MANAGER.value,
    },
    "corrective_action.update": {
        UserRole.SUPERVISOR.value,
        UserRole.QUALITY_MANAGER.value,
    },
    "corrective_action.submit_evidence": {
        UserRole.SUPERVISOR.value,
        UserRole.QUALITY_MANAGER.value,
    },
    "corrective_action.view": {
        UserRole.INSPECTOR.value,
        UserRole.SUPERVISOR.value,
        UserRole.QUALITY_MANAGER.value,
    },

    # --- Batch decisions ---
    "batch_decision.create": {UserRole.QUALITY_MANAGER.value},
    "batch_decision.view": {
        UserRole.INSPECTOR.value,
        UserRole.SUPERVISOR.value,
        UserRole.QUALITY_MANAGER.value,
    },

    # --- Dashboard ---
    "dashboard.view": {
        UserRole.INSPECTOR.value,
        UserRole.SUPERVISOR.value,
        UserRole.QUALITY_MANAGER.value,
    },

    # --- GenAI ---
    "genai.query": {
        UserRole.SUPERVISOR.value,
        UserRole.QUALITY_MANAGER.value,
    },

    # --- Audit ---
    "audit.view": {UserRole.QUALITY_MANAGER.value},

    # --- Users ---
    "user.manage": {UserRole.QUALITY_MANAGER.value},
}


def _get_current_user() -> User:
    """Return the current authenticated user or raise ForbiddenError."""
    user_id = get_jwt_identity()
    user = db.session.get(User, int(user_id))
    if user is None or not user.is_active:
        raise ForbiddenError("Account is inactive or not found")
    return user


def require_permission(action: str):
    """Decorator that checks the JWT user has the required role for *action*.

    Usage::

        @bp.route("/products", methods=["POST"])
        @require_permission("product.create")
        def create_product():
            ...
    """
    allowed_roles = PERMISSION_MATRIX.get(action)
    if allowed_roles is None:
        raise ValueError(f"Unknown permission action: {action}")

    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user = _get_current_user()
            if user.role not in allowed_roles:
                raise ForbiddenError(
                    f"Role '{user.role}' is not allowed to perform '{action}'"
                )
            # Attach user to kwargs so handlers can use it directly
            kwargs["current_user"] = user
            return fn(*args, **kwargs)
        return wrapper
    return decorator


def get_current_user_from_jwt() -> User:
    """Utility to fetch current user inside a request that already verified JWT."""
    return _get_current_user()
