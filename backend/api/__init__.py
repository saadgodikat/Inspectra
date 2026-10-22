"""API blueprints — central registration."""

from backend.api.auth import auth_bp
from backend.api.health import health_bp
from backend.api.users import users_bp
from backend.api.products import products_bp
from backend.api.batches import batches_bp
from backend.api.inspections import inspections_bp
from backend.api.reviews import reviews_bp
from backend.api.defects import defects_bp
from backend.api.corrective_actions import corrective_actions_bp
from backend.api.batch_decisions import batch_decisions_bp
from backend.api.audit import audit_bp
from backend.api.dashboard import dashboard_bp
from backend.api.inspection_items import items_bp


def register_blueprints(app):
    """Register all API blueprints on the Flask app."""
    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(products_bp)
    app.register_blueprint(batches_bp)
    app.register_blueprint(inspections_bp)
    app.register_blueprint(reviews_bp)
    app.register_blueprint(defects_bp)
    app.register_blueprint(corrective_actions_bp)
    app.register_blueprint(batch_decisions_bp)
    app.register_blueprint(audit_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(items_bp)
