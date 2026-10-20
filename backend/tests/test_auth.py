"""Tests for authentication endpoints (register, login, refresh, me)."""

from backend.models.user import User


class TestAuthAPI:
    """Authentication API test suite."""

    def test_register_success(self, client):
        resp = client.post(
            "/api/auth/register",
            json={
                "name": "New Inspector",
                "email": "new_inspector@example.com",
                "password": "securepassword123",
                "role": "inspector",
            },
        )
        assert resp.status_code == 201
        data = resp.get_json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["user"]["email"] == "new_inspector@example.com"
        assert data["user"]["role"] == "inspector"

    def test_register_duplicate_email(self, client, inspector_user):
        resp = client.post(
            "/api/auth/register",
            json={
                "name": "Duplicate Inspector",
                "email": inspector_user.email,
                "password": "password1234",
                "role": "inspector",
            },
        )
        assert resp.status_code == 409
        data = resp.get_json()
        assert "error" in data

    def test_register_validation_failure(self, client):
        resp = client.post(
            "/api/auth/register",
            json={
                "name": "",
                "email": "not-an-email",
                "password": "short",
                "role": "invalid_role",
            },
        )
        assert resp.status_code == 422
        data = resp.get_json()
        assert "details" in data
        assert "name" in data["details"]
        assert "email" in data["details"]
        assert "password" in data["details"]
        assert "role" in data["details"]

    def test_login_success(self, client, inspector_user):
        resp = client.post(
            "/api/auth/login",
            json={"email": inspector_user.email, "password": "testpass123"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["user"]["email"] == inspector_user.email

    def test_login_invalid_password(self, client, inspector_user):
        resp = client.post(
            "/api/auth/login",
            json={"email": inspector_user.email, "password": "wrongpassword"},
        )
        assert resp.status_code == 401
        data = resp.get_json()
        assert "error" in data

    def test_login_nonexistent_user(self, client):
        resp = client.post(
            "/api/auth/login",
            json={"email": "nobody@example.com", "password": "somepassword"},
        )
        assert resp.status_code == 401
        data = resp.get_json()
        assert "error" in data

    def test_me_authenticated(self, client, inspector_user):
        login_resp = client.post(
            "/api/auth/login",
            json={"email": inspector_user.email, "password": "testpass123"},
        )
        token = login_resp.get_json()["access_token"]
        resp = client.get(
            "/api/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["user"]["email"] == inspector_user.email

    def test_me_unauthenticated(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401

    def test_refresh_token(self, client, inspector_user):
        login_resp = client.post(
            "/api/auth/login",
            json={"email": inspector_user.email, "password": "testpass123"},
        )
        refresh_token = login_resp.get_json()["refresh_token"]
        resp = client.post(
            "/api/auth/refresh",
            headers={"Authorization": f"Bearer {refresh_token}"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert "access_token" in data
