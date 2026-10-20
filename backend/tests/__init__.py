"""Pytest configuration and fixtures for backend tests."""

import os
import pytest

# Set test environment before any app imports
os.environ["FLASK_ENV"] = "testing"

from backend.app import create_app
from backend.config import TestConfig
from backend.extensions import db as _db
from backend.models.user import User, UserRole


@pytest.fixture(scope="session")
def app():
    """Create the Flask application for the test session."""
    app = create_app(config_class=TestConfig)
    yield app


@pytest.fixture(scope="function")
def db(app):
    """Provide a fresh database for each test function."""
    with app.app_context():
        _db.create_all()
        yield _db
        _db.session.rollback()
        _db.drop_all()


@pytest.fixture(scope="function")
def client(app, db):
    """Flask test client."""
    return app.test_client()


@pytest.fixture()
def inspector_user(db):
    """Create and return a test inspector user."""
    user = User(name="Test Inspector", email="inspector@test.com", role=UserRole.INSPECTOR.value)
    user.set_password("testpass123")
    db.session.add(user)
    db.session.commit()
    return user


@pytest.fixture()
def supervisor_user(db):
    """Create and return a test supervisor user."""
    user = User(name="Test Supervisor", email="supervisor@test.com", role=UserRole.SUPERVISOR.value)
    user.set_password("testpass123")
    db.session.add(user)
    db.session.commit()
    return user


@pytest.fixture()
def quality_manager_user(db):
    """Create and return a test quality manager user."""
    user = User(
        name="Test QualityMgr", email="qm@test.com", role=UserRole.QUALITY_MANAGER.value
    )
    user.set_password("testpass123")
    db.session.add(user)
    db.session.commit()
    return user


def get_auth_headers(client, email="inspector@test.com", password="testpass123"):
    """Helper to get JWT auth headers by logging in."""
    resp = client.post("/api/auth/login", json={"email": email, "password": password})
    data = resp.get_json()
    token = data.get("access_token")
    return {"Authorization": f"Bearer {token}"}
