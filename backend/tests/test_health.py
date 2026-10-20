"""Tests for health-check endpoint and app startup."""


class TestHealthCheck:
    """Health endpoint tests."""

    def test_health_returns_200(self, client):
        resp = client.get("/api/health")
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["status"] == "healthy"
        assert data["database"] == "connected"

    def test_app_starts_without_errors(self, app):
        assert app is not None
        assert app.config["TESTING"] is True
