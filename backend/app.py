"""Flask application factory."""

import os
from flask import Flask

from backend.config import Config
from backend.extensions import db, migrate, jwt, cors
from backend.middleware.errors import register_error_handlers
from backend.api import register_blueprints


def create_app(config_class=None):
    """Create and configure the Flask application."""
    app = Flask(__name__, instance_relative_config=True)

    # Load configuration
    if config_class:
        app.config.from_object(config_class)
    else:
        app.config.from_object(Config)

    # Ensure instance folder exists (for SQLite)
    os.makedirs(app.instance_path, exist_ok=True)

    # Ensure upload directory exists
    upload_dir = app.config.get("UPLOAD_DIR", "uploads")
    if not os.path.isabs(upload_dir):
        upload_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), upload_dir)
    os.makedirs(upload_dir, exist_ok=True)
    app.config["UPLOAD_DIR"] = upload_dir

    # Initialise extensions
    db.init_app(app)
    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app, origins=app.config.get("CORS_ORIGINS", ["*"]))

    # Register error handlers
    register_error_handlers(app)

    # Register API blueprints
    register_blueprints(app)

    # Import models so Alembic detects them
    with app.app_context():
        import backend.models  # noqa: F401

    # Register CLI commands
    from backend.seed import register_seed_commands
    register_seed_commands(app)

    return app
