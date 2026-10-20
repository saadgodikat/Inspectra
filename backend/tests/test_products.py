"""Tests for Products API (CRUD, archival, search, RBAC, audit)."""

from backend.tests import get_auth_headers
from backend.models.product import Product
from backend.models.audit_event import AuditEvent


class TestProductsAPI:
    """Product CRUD and permission test suite."""

    def test_quality_manager_can_create_product(self, client, quality_manager_user):
        headers = get_auth_headers(
            client, email=quality_manager_user.email, password="testpass123"
        )
        resp = client.post(
            "/api/products",
            headers=headers,
            json={
                "product_code": "PRD-MET-001",
                "name": "Precision Metal Bracket",
                "category": "Metal Stamping",
                "description": "High-tolerance automotive mounting bracket.",
            },
        )
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["product"]["product_code"] == "PRD-MET-001"
        assert data["product"]["name"] == "Precision Metal Bracket"
        assert data["product"]["is_active"] is True

        # Verify audit event was logged
        event = AuditEvent.query.filter_by(
            action="product.create", entity_id=data["product"]["id"]
        ).first()
        assert event is not None
        assert event.actor_id == quality_manager_user.id

    def test_inspector_cannot_create_product(self, client, inspector_user):
        headers = get_auth_headers(
            client, email=inspector_user.email, password="testpass123"
        )
        resp = client.post(
            "/api/products",
            headers=headers,
            json={
                "product_code": "PRD-FAIL-01",
                "name": "Unauthorized Product",
            },
        )
        assert resp.status_code == 403

    def test_supervisor_cannot_create_product(self, client, supervisor_user):
        headers = get_auth_headers(
            client, email=supervisor_user.email, password="testpass123"
        )
        resp = client.post(
            "/api/products",
            headers=headers,
            json={
                "product_code": "PRD-FAIL-02",
                "name": "Unauthorized Product",
            },
        )
        assert resp.status_code == 403

    def test_product_validation_missing_fields(self, client, quality_manager_user):
        headers = get_auth_headers(
            client, email=quality_manager_user.email, password="testpass123"
        )
        resp = client.post(
            "/api/products",
            headers=headers,
            json={"product_code": "", "name": ""},
        )
        assert resp.status_code == 422
        data = resp.get_json()
        assert "product_code" in data["details"]
        assert "name" in data["details"]

    def test_duplicate_product_code(self, client, quality_manager_user):
        headers = get_auth_headers(
            client, email=quality_manager_user.email, password="testpass123"
        )
        client.post(
            "/api/products",
            headers=headers,
            json={"product_code": "PRD-DUP-01", "name": "First Product"},
        )
        resp = client.post(
            "/api/products",
            headers=headers,
            json={"product_code": "PRD-DUP-01", "name": "Duplicate Product"},
        )
        assert resp.status_code == 409
        assert "already exists" in resp.get_json()["error"]

    def test_all_roles_can_view_products(
        self, client, inspector_user, supervisor_user, quality_manager_user, db
    ):
        prod = Product(
            product_code="PRD-VIEW-01",
            name="Inspectable Part",
            category="Machined",
            is_active=True,
        )
        db.session.add(prod)
        db.session.commit()

        for user in [inspector_user, supervisor_user, quality_manager_user]:
            headers = get_auth_headers(
                client, email=user.email, password="testpass123"
            )
            resp = client.get("/api/products", headers=headers)
            assert resp.status_code == 200
            data = resp.get_json()
            assert len(data["products"]) >= 1

    def test_update_product(self, client, quality_manager_user, db):
        prod = Product(
            product_code="PRD-UPD-01",
            name="Original Name",
            category="Old Cat",
            is_active=True,
        )
        db.session.add(prod)
        db.session.commit()

        headers = get_auth_headers(
            client, email=quality_manager_user.email, password="testpass123"
        )
        resp = client.put(
            f"/api/products/{prod.id}",
            headers=headers,
            json={"name": "Updated Name", "category": "New Cat"},
        )
        assert resp.status_code == 200
        data = resp.get_json()
        assert data["product"]["name"] == "Updated Name"
        assert data["product"]["category"] == "New Cat"

        # Verify audit log
        event = AuditEvent.query.filter_by(
            action="product.update", entity_id=prod.id
        ).first()
        assert event is not None

    def test_archive_and_unarchive_product(self, client, quality_manager_user, db):
        prod = Product(
            product_code="PRD-ARCH-01",
            name="Archivable Part",
            is_active=True,
        )
        db.session.add(prod)
        db.session.commit()

        headers = get_auth_headers(
            client, email=quality_manager_user.email, password="testpass123"
        )

        # Archive
        resp = client.post(f"/api/products/{prod.id}/archive", headers=headers)
        assert resp.status_code == 200
        assert resp.get_json()["product"]["is_active"] is False

        # Filter by status
        resp_active = client.get("/api/products?status=active", headers=headers)
        assert all(p["id"] != prod.id for p in resp_active.get_json()["products"])

        resp_archived = client.get("/api/products?status=archived", headers=headers)
        assert any(p["id"] == prod.id for p in resp_archived.get_json()["products"])

        # Unarchive
        resp_un = client.post(f"/api/products/{prod.id}/unarchive", headers=headers)
        assert resp_un.status_code == 200
        assert resp_un.get_json()["product"]["is_active"] is True

    def test_search_and_filter_products(self, client, inspector_user, db):
        p1 = Product(product_code="PRD-FAST-01", name="Titanium Bolt", category="Fasteners")
        p2 = Product(product_code="PRD-SHEET-01", name="Steel Panel", category="Sheets")
        db.session.add_all([p1, p2])
        db.session.commit()

        headers = get_auth_headers(
            client, email=inspector_user.email, password="testpass123"
        )

        # Search by keyword
        resp = client.get("/api/products?search=titanium", headers=headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data["products"]) == 1
        assert data["products"][0]["product_code"] == "PRD-FAST-01"

        # Filter by category
        resp_cat = client.get("/api/products?category=Sheets", headers=headers)
        assert resp_cat.status_code == 200
        assert len(resp_cat.get_json()["products"]) == 1
        assert resp_cat.get_json()["products"][0]["product_code"] == "PRD-SHEET-01"
