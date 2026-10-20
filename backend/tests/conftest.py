"""Pytest conftest — makes fixtures available from __init__.py."""

from backend.tests import app, db, client, inspector_user, supervisor_user, quality_manager_user  # noqa: F401
