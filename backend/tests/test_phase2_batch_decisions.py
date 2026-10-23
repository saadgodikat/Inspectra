"""Phase 2 tests — Batch hold/release decision workflow.

Covers:
  - QM can hold and release a batch via batch-decision endpoint
  - Supervisor can hold but cannot release
  - Inspector cannot hold or release
  - Duplicate/terminal-state transitions are rejected
  - Evidence snapshot is captured at decision time
  - GET /api/batch-decisions/context returns live evidence
  - Reason is required and must be meaningful
  - Decision is recorded in audit trail
"""
import pytest
from backend.app import create_app
from backend.extensions import db as _db
from backend.models.user import User, UserRole
from backend.models.product import Product
from backend.models.batch import Batch, BatchStatus
from backend.models.inspection import Inspection, InspectionStatus
from backend.models.inspection_item import InspectionItem, ItemStatus
from backend.models.human_review import HumanReview
from backend.models.defect import Defect, DefectStatus
from backend.models.corrective_action import CorrectiveAction, ActionStatus


@pytest.fixture()
def app():
    app = create_app()
    app.config.update({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "JWT_SECRET_KEY": "test-secret",
        "UPLOAD_FOLDER": "/tmp/test_uploads_phase2",
    })
    with app.app_context():
        _db.create_all()
        yield app
        _db.session.remove()
        _db.drop_all()


@pytest.fixture()
def client(app):
    return app.test_client()


def _register_and_login(client, email, role):
    client.post("/api/auth/register", json={
        "name": f"Test {role}",
        "email": email,
        "password": "TestPass123!",
        "role": role,
    })
    r = client.post("/api/auth/login", json={"email": email, "password": "TestPass123!"})
    return r.get_json()["access_token"]


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


def _seed_batch(client, qm_token):
    """Create product + batch and return (product_id, batch_id)."""
    p = client.post("/api/products", json={
        "product_code": "PROD-P2",
        "name": "Phase2 Product",
        "category": "Test",
    }, headers=_auth(qm_token))
    product_id = p.get_json()["product"]["id"]

    b = client.post("/api/batches", json={
        "batch_number": "BATCH-P2-001",
        "product_id": product_id,
        "quantity": 200,
        "status": "under_inspection",
    }, headers=_auth(qm_token))
    batch_id = b.get_json()["batch"]["id"]
    return product_id, batch_id


# ── Tests ──────────────────────────────────────────────────────────────────────

def test_context_endpoint_returns_live_evidence(client):
    """Context endpoint returns counts and advisory list."""
    qm_token = _register_and_login(client, "qm_ctx@test.com", "quality_manager")
    _, batch_id = _seed_batch(client, qm_token)

    r = client.get(f"/api/batch-decisions/context/{batch_id}", headers=_auth(qm_token))
    assert r.status_code == 200
    ctx = r.get_json()["context"]
    assert ctx["batch_id"] == batch_id
    assert "total_inspected" in ctx
    assert "advisories" in ctx
    assert isinstance(ctx["advisories"], list)
    assert ctx["release_blocked"] is False  # Policy: no hard blocks


def test_qm_can_hold_batch(client):
    """Quality manager can place a batch on hold via decision endpoint."""
    qm_token = _register_and_login(client, "qm_hold@test.com", "quality_manager")
    _, batch_id = _seed_batch(client, qm_token)

    r = client.post("/api/batch-decisions", json={
        "batch_id": batch_id,
        "decision": "hold",
        "reason": "Pending review of critical inspection result",
    }, headers=_auth(qm_token))
    assert r.status_code == 201
    data = r.get_json()
    assert data["batch_decision"]["decision"] == "hold"
    assert data["batch_decision"]["advisories_acknowledged"] is False
    assert data["batch"]["status"] == "on_hold"
    assert "context" in data
    assert data["batch_decision"]["decided_by"]["role"] == "quality_manager"


def test_qm_can_release_batch(client):
    """Quality manager can release a batch that is on hold."""
    qm_token = _register_and_login(client, "qm_release@test.com", "quality_manager")
    _, batch_id = _seed_batch(client, qm_token)

    # Hold first
    client.post("/api/batch-decisions", json={
        "batch_id": batch_id,
        "decision": "hold",
        "reason": "Temporary hold for inspection",
    }, headers=_auth(qm_token))

    # Now release
    r = client.post("/api/batch-decisions", json={
        "batch_id": batch_id,
        "decision": "release",
        "reason": "All inspections reviewed, no open defects remain",
    }, headers=_auth(qm_token))
    assert r.status_code == 201
    data = r.get_json()
    assert data["batch_decision"]["decision"] == "release"
    assert data["batch"]["status"] == "released"


def test_release_requires_advisory_acknowledgement_and_records_snapshot(app, client):
    qm_token = _register_and_login(client, "qm_ack@test.com", "quality_manager")
    product_id, batch_id = _seed_batch(client, qm_token)

    with app.app_context():
        inspector = User.query.filter_by(role=UserRole.QUALITY_MANAGER.value).first()
        inspection = Inspection(
            product_id=product_id,
            batch_id=batch_id,
            inspector_id=inspector.id,
            status=InspectionStatus.PENDING_REVIEW.value,
        )
        _db.session.add(inspection)
        _db.session.flush()
        _db.session.add(InspectionItem(
            inspection_id=inspection.id,
            item_number=1,
            status=ItemStatus.PENDING_UPLOAD,
        ))
        _db.session.commit()

    payload = {
        "batch_id": batch_id,
        "decision": "release",
        "reason": "Reviewed the available sample evidence",
    }
    rejected = client.post(
        "/api/batch-decisions", json=payload, headers=_auth(qm_token)
    )
    assert rejected.status_code in (400, 422)
    assert "acknowledge_advisories" in rejected.get_json()["details"]

    payload["acknowledge_advisories"] = True
    accepted = client.post(
        "/api/batch-decisions", json=payload, headers=_auth(qm_token)
    )
    assert accepted.status_code == 201
    decision = accepted.get_json()["batch_decision"]
    assert decision["advisories_acknowledged"] is True
    assert decision["evidence_snapshot"]["total_items"] == 1
    assert decision["evidence_snapshot"]["pending_upload_items"] == 1


def test_supervisor_can_hold_but_not_release(client):
    """Supervisor may hold but cannot release — only QMs can release."""
    qm_token = _register_and_login(client, "qm_sv@test.com", "quality_manager")
    sv_token = _register_and_login(client, "sv_perm@test.com", "supervisor")
    _, batch_id = _seed_batch(client, qm_token)

    # Supervisor holds — allowed
    r = client.post("/api/batch-decisions", json={
        "batch_id": batch_id,
        "decision": "hold",
        "reason": "Supervisor initiated hold for review",
    }, headers=_auth(sv_token))
    assert r.status_code == 201

    # Supervisor tries to release — forbidden
    r = client.post("/api/batch-decisions", json={
        "batch_id": batch_id,
        "decision": "release",
        "reason": "Trying to release",
    }, headers=_auth(sv_token))
    assert r.status_code == 403


def test_inspector_cannot_hold_or_release(client):
    """Inspector role cannot create batch decisions."""
    qm_token = _register_and_login(client, "qm_ins@test.com", "quality_manager")
    ins_token = _register_and_login(client, "ins_perm@test.com", "inspector")
    _, batch_id = _seed_batch(client, qm_token)

    r = client.post("/api/batch-decisions", json={
        "batch_id": batch_id,
        "decision": "hold",
        "reason": "Inspector trying to hold",
    }, headers=_auth(ins_token))
    assert r.status_code in (403, 401)


def test_reason_is_required(client):
    """Empty or too-short reason is rejected."""
    qm_token = _register_and_login(client, "qm_reason@test.com", "quality_manager")
    _, batch_id = _seed_batch(client, qm_token)

    # Empty reason
    r = client.post("/api/batch-decisions", json={
        "batch_id": batch_id,
        "decision": "hold",
        "reason": "",
    }, headers=_auth(qm_token))
    assert r.status_code in (400, 422)

    # Too short
    r = client.post("/api/batch-decisions", json={
        "batch_id": batch_id,
        "decision": "hold",
        "reason": "ok",
    }, headers=_auth(qm_token))
    assert r.status_code in (400, 422)


def test_already_on_hold_rejected(client):
    """Holding an already-on-hold batch is rejected."""
    qm_token = _register_and_login(client, "qm_dup@test.com", "quality_manager")
    _, batch_id = _seed_batch(client, qm_token)

    client.post("/api/batch-decisions", json={
        "batch_id": batch_id, "decision": "hold",
        "reason": "Initial hold for quality check",
    }, headers=_auth(qm_token))

    r = client.post("/api/batch-decisions", json={
        "batch_id": batch_id, "decision": "hold",
        "reason": "Trying to hold again",
    }, headers=_auth(qm_token))
    assert r.status_code in (400, 422)


def test_released_batch_cannot_be_transitioned(client):
    """A released batch cannot be held or re-released."""
    qm_token = _register_and_login(client, "qm_term@test.com", "quality_manager")
    _, batch_id = _seed_batch(client, qm_token)

    # Release directly
    client.post("/api/batch-decisions", json={
        "batch_id": batch_id, "decision": "release",
        "reason": "Batch passes all quality checks",
    }, headers=_auth(qm_token))

    # Try to hold released batch
    r = client.post("/api/batch-decisions", json={
        "batch_id": batch_id, "decision": "hold",
        "reason": "Trying to hold a released batch",
    }, headers=_auth(qm_token))
    assert r.status_code in (400, 422)


def test_release_status_cannot_bypass_decision_workflow(client):
    qm_token = _register_and_login(client, "qm_bypass@test.com", "quality_manager")
    product_id, batch_id = _seed_batch(client, qm_token)

    status_update = client.post(
        f"/api/batches/{batch_id}/status",
        json={"status": "released", "reason": "Attempted direct release"},
        headers=_auth(qm_token),
    )
    assert status_update.status_code in (400, 422)

    direct_update = client.put(
        f"/api/batches/{batch_id}",
        json={"status": "released"},
        headers=_auth(qm_token),
    )
    assert direct_update.status_code in (400, 422)

    create_as_released = client.post(
        "/api/batches",
        json={
            "batch_number": "BATCH-P2-BYPASS",
            "product_id": product_id,
            "status": "released",
        },
        headers=_auth(qm_token),
    )
    assert create_as_released.status_code in (400, 422)


def test_snapshot_captures_counts(app, client):
    """Decision snapshot captures defect and action counts at time of decision."""
    qm_token = _register_and_login(client, "qm_snap@test.com", "quality_manager")
    product_id, batch_id = _seed_batch(client, qm_token)

    with app.app_context():
        # Manually insert inspection, defect, CAPA
        from backend.extensions import db
        user = User.query.filter_by(role=UserRole.QUALITY_MANAGER.value).first()
        ins = Inspection(
            product_id=product_id,
            batch_id=batch_id,
            inspector_id=user.id,
            status=InspectionStatus.REVIEWED.value,
        )
        db.session.add(ins)
        db.session.flush()

        review = HumanReview(
            inspection_id=ins.id,
            reviewer_id=user.id,
            decision="confirm",
            comments="Confirmed during quality review",
        )
        db.session.add(review)
        db.session.flush()

        defect = Defect(
            inspection_id=ins.id,
            review_id=review.id,
            defect_category="surface",
            description="Surface crack detected",
            severity="major",
            status=DefectStatus.OPEN.value,
            created_by_id=user.id,
        )
        db.session.add(defect)
        db.session.flush()

        action = CorrectiveAction(
            defect_id=defect.id,
            owner_id=user.id,
            status=ActionStatus.OPEN.value,
        )
        db.session.add(action)
        db.session.commit()

    r = client.post("/api/batch-decisions", json={
        "batch_id": batch_id,
        "decision": "hold",
        "reason": "Critical defect found in latest inspection",
    }, headers=_auth(qm_token))
    assert r.status_code == 201
    d = r.get_json()["batch_decision"]
    assert d["total_inspected"] >= 1
    assert d["total_confirmed_defects"] >= 1
    assert d["total_open_actions"] >= 1


def test_decision_history_retrievable(client):
    """Batch decisions are retrievable via GET /api/batch-decisions?batch_id=..."""
    qm_token = _register_and_login(client, "qm_hist@test.com", "quality_manager")
    _, batch_id = _seed_batch(client, qm_token)

    client.post("/api/batch-decisions", json={
        "batch_id": batch_id, "decision": "hold",
        "reason": "Hold for re-inspection of critical area",
    }, headers=_auth(qm_token))

    r = client.get(f"/api/batch-decisions?batch_id={batch_id}", headers=_auth(qm_token))
    assert r.status_code == 200
    data = r.get_json()
    assert data["total"] >= 1
    assert data["batch_decisions"][0]["decided_by"]["role"] == "quality_manager"
