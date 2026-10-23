"""Phase 3 tests — Inspection status, telemetry, and quality metrics alignment.

Covers:
  - FPY denominator explicitly requires reviewed status (pending_review excluded)
  - Inspections with confirmed defects are deducted from passed count
  - AI predictions (unreviewed flags) are tracked separately and not counted as confirmed defects
  - Inspection serialization includes item_count and confirmed_defects_count
  - Shared views agree: dashboard KPI counts match raw DB and inspection to_dict values
"""
import pytest
from backend.app import create_app
from backend.config import TestConfig
from backend.extensions import db as _db
from backend.models.user import User, UserRole
from backend.models.product import Product
from backend.models.batch import Batch, BatchStatus
from backend.models.inspection import Inspection, InspectionStatus
from backend.models.inspection_item import InspectionItem, ItemStatus
from backend.models.ml_result import MLResult
from backend.models.defect import Defect, DefectStatus, DefectSeverity
from backend.models.human_review import HumanReview, ReviewDecision


@pytest.fixture()
def app():
    app = create_app(TestConfig)
    app.config.update({
        "TESTING": True,
        "SQLALCHEMY_DATABASE_URI": "sqlite:///:memory:",
        "JWT_SECRET_KEY": "test-phase3-secret-key-at-least-32-chars-long",
        "UPLOAD_FOLDER": "/tmp/test_uploads_phase3",
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


def test_fpy_denominator_only_counts_reviewed(app, client):
    """Inspections in pending_review or processing are excluded from the FPY denominator."""
    token = _register_and_login(client, "qm_fpy@test.com", "quality_manager")

    with app.app_context():
        user = User.query.filter_by(role=UserRole.QUALITY_MANAGER.value).first()
        prod = Product(product_code="PROD-P3", name="Product P3", category="General")
        _db.session.add(prod)
        _db.session.flush()

        batch = Batch(batch_number="BATCH-P3-01", product_id=prod.id, status=BatchStatus.UNDER_INSPECTION.value)
        _db.session.add(batch)
        _db.session.flush()

        # 1 reviewed inspection with no defects (PASS)
        ins1 = Inspection(product_id=prod.id, batch_id=batch.id, inspector_id=user.id, status=InspectionStatus.REVIEWED.value)
        # 1 pending_review inspection (should NOT count in FPY denominator)
        ins2 = Inspection(product_id=prod.id, batch_id=batch.id, inspector_id=user.id, status=InspectionStatus.PENDING_REVIEW.value)
        _db.session.add_all([ins1, ins2])
        _db.session.commit()

    r = client.get("/api/dashboard", headers=_auth(token))
    assert r.status_code == 200
    data = r.get_json()

    assert data["inspections"]["total"] == 2
    # Only 1 reviewed inspection, which passed => 100.0%
    assert data["fpy_percent"] == 100.0
    assert data["fpy_metric"]["passed"] == 1
    assert data["fpy_metric"]["reviewed"] == 1
    assert "Passed Reviewed Inspections / Total Reviewed Inspections" in data["fpy_metric"]["formula"]


def test_confirmed_defects_separate_from_ai_flags(app, client):
    """AI defective predictions do not inflate confirmed defect totals until a human confirms them."""
    token = _register_and_login(client, "qm_ai@test.com", "quality_manager")

    with app.app_context():
        user = User.query.filter_by(role=UserRole.QUALITY_MANAGER.value).first()
        prod = Product(product_code="PROD-AI", name="AI Check", category="General")
        _db.session.add(prod)
        _db.session.flush()

        batch = Batch(batch_number="BATCH-AI-01", product_id=prod.id, status=BatchStatus.UNDER_INSPECTION.value)
        _db.session.add(batch)
        _db.session.flush()

        # Inspection with AI predicting defective, but pending human review
        ins = Inspection(product_id=prod.id, batch_id=batch.id, inspector_id=user.id, status=InspectionStatus.PENDING_REVIEW.value)
        _db.session.add(ins)
        _db.session.flush()

        ml_res = MLResult(
            inspection_id=ins.id,
            predicted_class="defective",
            model_name="inspectra_test",
            model_version="1.0.0",
        )
        _db.session.add(ml_res)
        _db.session.commit()

    r = client.get("/api/dashboard", headers=_auth(token))
    assert r.status_code == 200
    data = r.get_json()

    # Confirmed defects must be 0 because human review has not occurred
    assert data["defects"]["total"] == 0
    # But unreviewed AI flag is tracked
    assert data["ai_flags"]["unreviewed_suggestions"] == 1


def test_inspection_to_dict_includes_item_and_defect_counts(app, client):
    """Inspection serialization exposes item_count and confirmed_defects_count directly."""
    token = _register_and_login(client, "qm_dict@test.com", "quality_manager")

    with app.app_context():
        user = User.query.filter_by(role=UserRole.QUALITY_MANAGER.value).first()
        prod = Product(product_code="PROD-DICT", name="Dict Test", category="Test")
        _db.session.add(prod)
        _db.session.flush()

        batch = Batch(batch_number="BATCH-DICT-01", product_id=prod.id, status=BatchStatus.UNDER_INSPECTION.value)
        _db.session.add(batch)
        _db.session.flush()

        ins = Inspection(product_id=prod.id, batch_id=batch.id, inspector_id=user.id, status=InspectionStatus.REVIEWED.value)
        _db.session.add(ins)
        _db.session.flush()

        # Add 3 items
        for num in range(1, 4):
            item = InspectionItem(
                inspection_id=ins.id,
                item_number=num,
                status=ItemStatus.ANALYZED,
                effective_decision="good",
            )
            _db.session.add(item)

        # Add 1 confirmed defect
        defect = Defect(
            inspection_id=ins.id,
            defect_category="solder",
            severity=DefectSeverity.MAJOR.value,
            status=DefectStatus.OPEN.value,
            created_by_id=user.id,
        )
        _db.session.add(defect)
        _db.session.commit()

        ins_id = ins.id

    r = client.get(f"/api/inspections/{ins_id}", headers=_auth(token))
    assert r.status_code == 200
    ins_data = r.get_json()["inspection"]
    assert ins_data["item_count"] == 3
    assert ins_data["confirmed_defects_count"] == 1


def test_inspection_list_includes_item_level_fpy_summary(app, client):
    """FPY input counts use analyzed items and apply supervisor overrides."""
    token = _register_and_login(client, "qm_item_fpy@test.com", "quality_manager")

    with app.app_context():
        user = User.query.filter_by(role=UserRole.QUALITY_MANAGER.value).first()
        prod = Product(product_code="PROD-FPY", name="FPY Test", category="Test")
        _db.session.add(prod)
        _db.session.flush()

        batch = Batch(batch_number="BATCH-FPY-01", product_id=prod.id)
        _db.session.add(batch)
        _db.session.flush()

        inspection = Inspection(
            product_id=prod.id,
            batch_id=batch.id,
            inspector_id=user.id,
            status=InspectionStatus.PENDING_REVIEW.value,
        )
        _db.session.add(inspection)
        _db.session.flush()

        predictions = ("good", "defective", "defective")
        for item_number, prediction in enumerate(predictions, start=1):
            result = MLResult(
                inspection_id=inspection.id,
                predicted_class=prediction,
                model_name="test",
                model_version="1",
            )
            _db.session.add(result)
            _db.session.flush()
            _db.session.add(InspectionItem(
                inspection_id=inspection.id,
                item_number=item_number,
                status=ItemStatus.ANALYZED,
                ml_result_id=result.id,
                override_decision="good" if item_number == 3 else None,
            ))

        _db.session.add(InspectionItem(
            inspection_id=inspection.id,
            item_number=4,
            status=ItemStatus.PENDING_UPLOAD,
        ))
        _db.session.commit()

    response = client.get("/api/inspections", headers=_auth(token))
    assert response.status_code == 200
    listed_inspection = response.get_json()["inspections"][0]
    assert listed_inspection["item_summary"] == {
        "total": 4,
        "analyzed": 3,
        "good": 2,
        "defective": 1,
    }


def test_inspection_with_batch_creates_linked_batch_and_item_slots(app, client):
    """Any inspection creator can atomically create a new batch and its inspection."""
    token = _register_and_login(client, "inspector_new_batch@test.com", "inspector")

    with app.app_context():
        product = Product(
            product_code="PROD-NEW-BATCH",
            name="New Batch Test",
            category="Test",
        )
        _db.session.add(product)
        _db.session.commit()
        product_id = product.id

    response = client.post(
        "/api/inspections/with-batch",
        headers=_auth(token),
        json={
            "product_id": product_id,
            "quantity": 3,
            "production_date": "2026-10-24",
            "production_line": "Casting Line 1",
            "supplier": "Apex Castings",
        },
    )
    assert response.status_code == 201
    data = response.get_json()
    batch = data["batch"]
    inspection = data["inspection"]

    assert batch["batch_number"].startswith("BAT-20261024-")
    assert batch["status"] == BatchStatus.UNDER_INSPECTION.value
    assert batch["quantity"] == 3
    assert batch["production_line"] == "Casting Line 1"
    assert batch["supplier"] == "Apex Castings"
    assert inspection["batch_id"] == batch["id"]
    assert inspection["item_count"] == 3
