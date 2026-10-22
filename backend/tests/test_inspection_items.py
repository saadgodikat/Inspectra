"""Tests for allocated inspection items, bulk upload, analysis, and overrides."""

import io

from PIL import Image

from backend.models.batch import Batch
from backend.models.inspection_item import InspectionItem, ItemStatus
from backend.models.product import Product
from backend.tests import get_auth_headers


def make_image_bytes() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", (16, 16), color=(20, 80, 120)).save(buffer, format="JPEG")
    return buffer.getvalue()


def create_inspection(client, inspector_user, db, quantity=3):
    product = Product(
        product_code="PRD-ITEM-01",
        name="Inspection Item Test",
        is_active=True,
    )
    db.session.add(product)
    db.session.flush()
    batch = Batch(
        batch_number="BAT-ITEM-01",
        product_id=product.id,
        quantity=max(5, quantity),
        status="under_inspection",
    )
    db.session.add(batch)
    db.session.commit()

    headers = get_auth_headers(client, email=inspector_user.email)
    response = client.post(
        "/api/inspections",
        headers=headers,
        json={
            "product_id": product.id,
            "batch_id": batch.id,
            "quantity": quantity,
        },
    )
    assert response.status_code == 201
    return response.get_json()["inspection"]["id"], headers


class TestInspectionItemsAPI:
    def test_inspection_creation_allocates_requested_item_slots(self, client, inspector_user, db):
        inspection_id, _ = create_inspection(client, inspector_user, db, quantity=3)

        items = (
            InspectionItem.query
            .filter_by(inspection_id=inspection_id)
            .order_by(InspectionItem.item_number)
            .all()
        )
        assert [item.item_number for item in items] == [1, 2, 3]
        assert all(item.status == ItemStatus.PENDING_UPLOAD for item in items)

    def test_creation_rejects_quantity_greater_than_batch_quantity(
        self, client, inspector_user, db
    ):
        product = Product(
            product_code="PRD-ITEM-02",
            name="Quantity Validation Test",
            is_active=True,
        )
        db.session.add(product)
        db.session.flush()
        batch = Batch(batch_number="BAT-ITEM-02", product_id=product.id, quantity=5)
        db.session.add(batch)
        db.session.commit()

        headers = get_auth_headers(client, email=inspector_user.email)
        response = client.post(
            "/api/inspections",
            headers=headers,
            json={"product_id": product.id, "batch_id": batch.id, "quantity": 6},
        )
        assert response.status_code == 422
        assert "quantity" in response.get_json()["details"]

    def test_bulk_upload_matches_filenames_and_reports_unmatched(
        self, client, inspector_user, db
    ):
        inspection_id, headers = create_inspection(client, inspector_user, db, quantity=60)
        image_bytes = make_image_bytes()

        response = client.post(
            f"/api/inspections/{inspection_id}/bulk-upload",
            headers=headers,
            data={
                "images": [
                    (io.BytesIO(image_bytes), "059.jpg"),
                    (io.BytesIO(image_bytes), "casting_002.jpg"),
                    (io.BytesIO(image_bytes), "no-number.jpg"),
                ]
            },
            content_type="multipart/form-data",
        )

        assert response.status_code == 200
        data = response.get_json()
        assert [item["item_number"] for item in data["succeeded"]] == [59, 2]
        assert data["total_uploaded"] == 2
        assert data["total_errors"] == 1
        assert "rename to match item number" in data["errors"][0]["error"].lower()

        items = InspectionItem.query.filter(
            InspectionItem.inspection_id == inspection_id,
            InspectionItem.item_number.in_([2, 59]),
        ).all()
        assert all(item.status == ItemStatus.UPLOADED for item in items)
        assert all(item.image_id is not None for item in items)

        list_response = client.get(
            f"/api/inspections/{inspection_id}/items",
            headers=headers,
        )
        assert list_response.status_code == 200
        listing = list_response.get_json()
        assert listing["summary"]["total"] == 60
        assert listing["summary"]["uploaded"] == 2
        assert listing["summary"]["pending_upload"] == 58

    def test_run_analysis_returns_current_summary_and_supervisor_can_override(
        self, client, inspector_user, supervisor_user, db, monkeypatch
    ):
        inspection_id, inspector_headers = create_inspection(
            client, inspector_user, db, quantity=2
        )
        image_bytes = make_image_bytes()
        upload_response = client.post(
            f"/api/inspections/{inspection_id}/bulk-upload",
            headers=inspector_headers,
            data={"images": [(io.BytesIO(image_bytes), "item_001.jpg")]},
            content_type="multipart/form-data",
        )
        assert upload_response.status_code == 200

        from backend.api import inspection_items as inspection_items_api

        monkeypatch.setattr(
            inspection_items_api,
            "run_efficientnet",
            lambda _path: {
                "predicted_class": "defective",
                "scores": {"good": 0.1, "defective": 0.9},
                "model_name": "EfficientNet-B0",
                "model_version": "test",
                "duration_ms": 12,
            },
        )

        analysis_response = client.post(
            f"/api/inspections/{inspection_id}/run-analysis",
            headers=inspector_headers,
        )
        assert analysis_response.status_code == 200
        summary = analysis_response.get_json()
        assert summary["total"] == 2
        assert summary["analyzed"] == 1
        assert summary["good"] == 0
        assert summary["defective"] == 1
        assert summary["pending_upload"] == 1

        supervisor_headers = get_auth_headers(client, email=supervisor_user.email)
        override_response = client.patch(
            f"/api/inspections/{inspection_id}/items/1/override",
            headers=supervisor_headers,
            json={"decision": "good", "comment": "Verified manually"},
        )
        assert override_response.status_code == 200
        assert override_response.get_json()["item"]["effective_decision"] == "good"

        inspector_override = client.patch(
            f"/api/inspections/{inspection_id}/items/1/override",
            headers=inspector_headers,
            json={"decision": "defective"},
        )
        assert inspector_override.status_code == 403

        repeated_analysis = client.post(
            f"/api/inspections/{inspection_id}/run-analysis",
            headers=inspector_headers,
        )
        repeated_summary = repeated_analysis.get_json()
        assert repeated_summary["analyzed"] == 1
        assert repeated_summary["good"] == 1
        assert repeated_summary["pending_upload"] == 1
