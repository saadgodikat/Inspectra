"""Tests for Batches API (CRUD, status transitions, archival, RBAC, audit)."""

from backend.tests import get_auth_headers
from backend.models.product import Product
from backend.models.batch import Batch, BatchStatus
from backend.models.audit_event import AuditEvent


class TestBatchesAPI:
    """Batch CRUD and permission test suite."""

    def test_supervisor_and_qm_can_create_batch(
        self, client, supervisor_user, quality_manager_user, db
    ):
        prod = Product(
            product_code="PRD-BATCH-01",
            name="Batch Test Part",
            is_active=True,
        )
        db.session.add(prod)
        db.session.commit()

        # Supervisor creates batch
        sup_headers = get_auth_headers(
            client, email=supervisor_user.email, password="testpass123"
        )
        resp1 = client.post(
            "/api/batches",
            headers=sup_headers,
            json={
                "batch_number": "BAT-2026-001",
                "product_id": prod.id,
                "production_date": "2026-10-20",
                "quantity": 500,
                "production_line": "Line A-1",
                "supplier": "Acme Metalworks",
            },
        )
        assert resp1.status_code == 201
        data1 = resp1.get_json()
        assert data1["batch"]["batch_number"] == "BAT-2026-001"
        assert data1["batch"]["status"] == "created"
        assert data1["batch"]["product"]["product_code"] == "PRD-BATCH-01"

        # Quality Manager creates batch
        qm_headers = get_auth_headers(
            client, email=quality_manager_user.email, password="testpass123"
        )
        resp2 = client.post(
            "/api/batches",
            headers=qm_headers,
            json={
                "batch_number": "BAT-2026-002",
                "product_id": prod.id,
                "production_date": "2026-10-21",
                "quantity": 250,
            },
        )
        assert resp2.status_code == 201

        # Verify audit log
        event = AuditEvent.query.filter_by(
            action="batch.create", entity_id=data1["batch"]["id"]
        ).first()
        assert event is not None
        assert event.actor_id == supervisor_user.id

    def test_inspector_cannot_create_batch(self, client, inspector_user, db):
        prod = Product(product_code="PRD-NOBATCH-01", name="Part", is_active=True)
        db.session.add(prod)
        db.session.commit()

        headers = get_auth_headers(
            client, email=inspector_user.email, password="testpass123"
        )
        resp = client.post(
            "/api/batches",
            headers=headers,
            json={
                "batch_number": "BAT-UNAUTH-01",
                "product_id": prod.id,
            },
        )
        assert resp.status_code == 403

    def test_cannot_create_batch_for_archived_product(
        self, client, supervisor_user, db
    ):
        prod = Product(
            product_code="PRD-ARCH-PROD",
            name="Archived Part",
            is_active=False,
        )
        db.session.add(prod)
        db.session.commit()

        headers = get_auth_headers(
            client, email=supervisor_user.email, password="testpass123"
        )
        resp = client.post(
            "/api/batches",
            headers=headers,
            json={
                "batch_number": "BAT-FAIL-ARCH",
                "product_id": prod.id,
            },
        )
        assert resp.status_code == 422
        assert "archived" in resp.get_json()["details"]["product_id"]

    def test_duplicate_batch_number(self, client, supervisor_user, db):
        prod = Product(product_code="PRD-DUPBAT", name="Part", is_active=True)
        db.session.add(prod)
        db.session.commit()

        headers = get_auth_headers(
            client, email=supervisor_user.email, password="testpass123"
        )
        client.post(
            "/api/batches",
            headers=headers,
            json={"batch_number": "BAT-DUP-01", "product_id": prod.id},
        )
        resp = client.post(
            "/api/batches",
            headers=headers,
            json={"batch_number": "BAT-DUP-01", "product_id": prod.id},
        )
        assert resp.status_code == 409
        assert "already exists" in resp.get_json()["error"]

    def test_update_batch_and_status_transition(self, client, supervisor_user, db):
        prod = Product(product_code="PRD-TRANS", name="Part", is_active=True)
        db.session.add(prod)
        db.session.flush()

        batch = Batch(
            batch_number="BAT-TRANS-01",
            product_id=prod.id,
            quantity=100,
            status=BatchStatus.CREATED.value,
        )
        db.session.add(batch)
        db.session.commit()

        headers = get_auth_headers(
            client, email=supervisor_user.email, password="testpass123"
        )

        # Transition status
        resp = client.post(
            f"/api/batches/{batch.id}/status",
            headers=headers,
            json={"status": "under_inspection", "reason": "Incoming sample inspection"},
        )
        assert resp.status_code == 200
        assert resp.get_json()["batch"]["status"] == "under_inspection"

        # Verify audit log
        event = AuditEvent.query.filter_by(
            action="batch.status_change", entity_id=batch.id
        ).first()
        assert event is not None
        assert event.details["from_status"] == "created"
        assert event.details["to_status"] == "under_inspection"

    def test_archive_batch(self, client, supervisor_user, db):
        prod = Product(product_code="PRD-BARCH", name="Part", is_active=True)
        db.session.add(prod)
        db.session.flush()

        batch = Batch(
            batch_number="BAT-ARCH-01",
            product_id=prod.id,
            status=BatchStatus.RELEASED.value,
        )
        db.session.add(batch)
        db.session.commit()

        headers = get_auth_headers(
            client, email=supervisor_user.email, password="testpass123"
        )
        resp = client.post(f"/api/batches/{batch.id}/archive", headers=headers)
        assert resp.status_code == 200
        assert resp.get_json()["batch"]["status"] == "archived"

        # Verify batch record still exists and is queryable
        b = db.session.get(Batch, batch.id)
        assert b is not None
        assert b.status == "archived"

    def test_search_and_filter_batches(self, client, inspector_user, db):
        p1 = Product(product_code="PRD-F1", name="Part 1", is_active=True)
        p2 = Product(product_code="PRD-F2", name="Part 2", is_active=True)
        db.session.add_all([p1, p2])
        db.session.flush()

        b1 = Batch(
            batch_number="BAT-ALPHA-01",
            product_id=p1.id,
            supplier="Alpha Co",
            status="under_inspection",
        )
        b2 = Batch(
            batch_number="BAT-BETA-02",
            product_id=p2.id,
            supplier="Beta Inc",
            status="produced",
        )
        db.session.add_all([b1, b2])
        db.session.commit()

        headers = get_auth_headers(
            client, email=inspector_user.email, password="testpass123"
        )

        # Filter by product_id
        resp_p = client.get(f"/api/batches?product_id={p1.id}", headers=headers)
        assert len(resp_p.get_json()["batches"]) == 1
        assert resp_p.get_json()["batches"][0]["batch_number"] == "BAT-ALPHA-01"

        # Filter by status
        resp_s = client.get("/api/batches?status=produced", headers=headers)
        assert len(resp_s.get_json()["batches"]) == 1
        assert resp_s.get_json()["batches"][0]["batch_number"] == "BAT-BETA-02"

        # Search keyword
        resp_k = client.get("/api/batches?search=Alpha", headers=headers)
        assert len(resp_k.get_json()["batches"]) == 1
        assert resp_k.get_json()["batches"][0]["supplier"] == "Alpha Co"
