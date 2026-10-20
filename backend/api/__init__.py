"""API blueprints — central registration."""

from backend.api.auth import auth_bp
from backend.api.health import health_bp
from backend.api.users import users_bp
from backend.api.products import products_bp
from backend.api.batches import batches_bp
from backend.api.inspections import inspections_bp


def register_blueprints(app):
    """Register all API blueprints on the Flask app."""
    app.register_blueprint(health_bp)
    app.register_blueprint(auth_bp)
    app.register_blueprint(users_bp)
    app.register_blueprint(products_bp)
    app.register_blueprint(batches_bp)
    app.register_blueprint(inspections_bp)
