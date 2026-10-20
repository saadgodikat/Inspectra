"""Tests for role-based access control and user management."""

from backend.tests import get_auth_headers


class TestPermissionsAndRoles:
    """RBAC validation test suite."""

    def test_quality_manager_can_list_users(self, client, quality_manager_user):
        headers = get_auth_headers(
            client, email=quality_manager_user.email, password="testpass123"
        )
        resp = client.get("/api/users", headers=headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert "users" in data
        assert len(data["users"]) >= 1

    def test_inspector_cannot_list_users(self, client, inspector_user):
        headers = get_auth_headers(
            client, email=inspector_user.email, password="testpass123"
        )
        resp = client.get("/api/users", headers=headers)
        assert resp.status_code == 403
        data = resp.get_json()
        assert "error" in data
        assert "not allowed" in data["error"]

    def test_supervisor_cannot_list_users(self, client, supervisor_user):
        headers = get_auth_headers(
            client, email=supervisor_user.email, password="testpass123"
        )
        resp = client.get("/api/users", headers=headers)
        assert resp.status_code == 403
        data = resp.get_json()
        assert "error" in data

    def test_quality_manager_can_deactivate_and_reactivate_user(
        self, client, quality_manager_user, inspector_user
    ):
        headers = get_auth_headers(
            client, email=quality_manager_user.email, password="testpass123"
        )

        # Deactivate
        resp = client.post(
            f"/api/users/{inspector_user.id}/deactivate", headers=headers
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["user"]["is_active"] is False

        # Deactivated user cannot log in
        login_resp = client.post(
            "/api/auth/login",
            json={"email": inspector_user.email, "password": "testpass123"},
        )
        assert login_resp.status_code == 403

        # Reactivate
        resp = client.post(
            f"/api/users/{inspector_user.id}/activate", headers=headers
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["user"]["is_active"] is True

        # Can log in again
        login_resp = client.post(
            "/api/auth/login",
            json={"email": inspector_user.email, "password": "testpass123"},
        )
        assert login_resp.status_code == 200

    def test_cannot_deactivate_self(self, client, quality_manager_user):
        headers = get_auth_headers(
            client, email=quality_manager_user.email, password="testpass123"
        )
        resp = client.post(
            f"/api/users/{quality_manager_user.id}/deactivate", headers=headers
        )
        assert resp.status_code == 400
