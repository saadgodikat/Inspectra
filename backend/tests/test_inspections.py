"""Tests for Inspections API and secure image upload service."""

import io
from PIL import Image
from backend.tests import get_auth_headers
from backend.models.product import Product
from backend.models.batch import Batch
from backend.models.inspection import Inspection, InspectionStatus
from backend.models.inspection_image import InspectionImage
from backend.models.audit_event import AuditEvent


def create_dummy_image(format="JPEG", size=(100, 100), color=(255, 0, 0)) -> bytes:
    """Helper to generate valid image bytes in memory."""
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=color)
    img.save(buf, format=format)
    return buf.getvalue()


class TestInspectionsAPI:
    """Inspection creation, listing, updating, and draft lifecycle tests."""

    def test_create_inspection_success(self, client, inspector_user, db):
        prod = Product(product_code="PRD-INSP-01", name="Test Part", is_active=True)
        db.session.add(prod)
        db.session.flush()

        batch = Batch(batch_number="BAT-INSP-01", product_id=prod.id, status="under_inspection")
        db.session.add(batch)
        db.session.commit()

        headers = get_auth_headers(client, email=inspector_user.email, password="testpass123")
        resp = client.post(
            "/api/inspections",
            headers=headers,
            json={
                "product_id": prod.id,
                "batch_id": batch.id,
                "sample_reference": "SAMPLE-A1",
                "sample_type": "surface",
                "observations": "Minor surface discoloration observed under magnification.",
            },
        )
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["inspection"]["product_id"] == prod.id
        assert data["inspection"]["batch_id"] == batch.id
        assert data["inspection"]["sample_type"] == "surface"
        assert data["inspection"]["sample_reference"] == "SAMPLE-A1"
        assert data["inspection"]["status"] == InspectionStatus.PENDING_UPLOAD.value

        # Verify audit log
        event = AuditEvent.query.filter_by(
            action="inspection.create", entity_id=data["inspection"]["id"]
        ).first()
        assert event is not None
        assert event.actor_id == inspector_user.id

    def test_create_inspection_reject_unknown_product(self, client, inspector_user, db):
        headers = get_auth_headers(client, email=inspector_user.email, password="testpass123")
        resp = client.post(
            "/api/inspections",
            headers=headers,
            json={"product_id": 99999, "batch_id": 1},
        )
        assert resp.status_code == 422
        assert "product_id" in resp.get_json()["details"]

    def test_create_inspection_reject_batch_mismatch(self, client, inspector_user, db):
        p1 = Product(product_code="PRD-P1", name="Product 1", is_active=True)
        p2 = Product(product_code="PRD-P2", name="Product 2", is_active=True)
        db.session.add_all([p1, p2])
        db.session.flush()

        b2 = Batch(batch_number="BAT-FOR-P2", product_id=p2.id)
        db.session.add(b2)
        db.session.commit()

        # Try linking p1 with b2 (which belongs to p2)
        headers = get_auth_headers(client, email=inspector_user.email, password="testpass123")
        resp = client.post(
            "/api/inspections",
            headers=headers,
            json={"product_id": p1.id, "batch_id": b2.id},
        )
        assert resp.status_code == 422
        assert "does not belong" in resp.get_json()["details"]["batch_id"]

    def test_create_inspection_reject_archived_product_or_batch(self, client, inspector_user, db):
        prod = Product(product_code="PRD-ARCH", name="Archived Prod", is_active=False)
        db.session.add(prod)
        db.session.flush()

        batch = Batch(batch_number="BAT-ARCH", product_id=prod.id, status="archived")
        db.session.add(batch)
        db.session.commit()

        headers = get_auth_headers(client, email=inspector_user.email, password="testpass123")
        resp = client.post(
            "/api/inspections",
            headers=headers,
            json={"product_id": prod.id, "batch_id": batch.id},
        )
        assert resp.status_code == 422
        assert "archived" in resp.get_json()["details"]["product_id"]

    def test_create_inspection_validate_sample_types(self, client, inspector_user, db):
        prod = Product(product_code="PRD-ST", name="Prod", is_active=True)
        db.session.add(prod)
        db.session.flush()
        batch = Batch(batch_number="BAT-ST", product_id=prod.id)
        db.session.add(batch)
        db.session.commit()

        headers = get_auth_headers(client, email=inspector_user.email, password="testpass123")
        # Invalid sample_type
        resp = client.post(
            "/api/inspections",
            headers=headers,
            json={"product_id": prod.id, "batch_id": batch.id, "sample_type": "invalid_type"},
        )
        assert resp.status_code == 422

        # Valid sample_types
        for valid_type in ["item", "surface", "batch_sample"]:
            r = client.post(
                "/api/inspections",
                headers=headers,
                json={"product_id": prod.id, "batch_id": batch.id, "sample_type": valid_type},
            )
            assert r.status_code == 201

    def test_list_and_filter_inspections(self, client, inspector_user, supervisor_user, db):
        prod = Product(product_code="PRD-LIST", name="Filter Part", is_active=True)
        db.session.add(prod)
        db.session.flush()
        batch = Batch(batch_number="BAT-LIST", product_id=prod.id)
        db.session.add(batch)
        db.session.flush()

        insp1 = Inspection(
            product_id=prod.id,
            batch_id=batch.id,
            inspector_id=inspector_user.id,
            sample_type="item",
            sample_reference="REF-001",
            observations="Check edge for burrs",
            status="pending_upload",
        )
        insp2 = Inspection(
            product_id=prod.id,
            batch_id=batch.id,
            inspector_id=supervisor_user.id,
            sample_type="surface",
            sample_reference="REF-002",
            observations="Check coating thickness",
            status="reviewed",
        )
        db.session.add_all([insp1, insp2])
        db.session.commit()

        headers = get_auth_headers(client, email=inspector_user.email, password="testpass123")

        # Filter by sample_type
        resp = client.get("/api/inspections?sample_type=surface", headers=headers)
        assert resp.status_code == 200
        data = resp.get_json()
        assert len(data["inspections"]) == 1
        assert data["inspections"][0]["sample_reference"] == "REF-002"

        # Search keyword
        resp_search = client.get("/api/inspections?search=burrs", headers=headers)
        assert len(resp_search.get_json()["inspections"]) == 1
        assert resp_search.get_json()["inspections"][0]["sample_reference"] == "REF-001"

    def test_patch_draft_inspection_and_immutable_lock(self, client, inspector_user, db):
        prod = Product(product_code="PRD-PATCH", name="Part", is_active=True)
        db.session.add(prod)
        db.session.flush()
        batch = Batch(batch_number="BAT-PATCH", product_id=prod.id)
        db.session.add(batch)
        db.session.flush()

        insp = Inspection(
            product_id=prod.id,
            batch_id=batch.id,
            inspector_id=inspector_user.id,
            observations="Initial draft notes",
            status="pending_upload",
        )
        db.session.add(insp)
        db.session.commit()

        headers = get_auth_headers(client, email=inspector_user.email, password="testpass123")

        # Patch draft observations
        resp = client.patch(
            f"/api/inspections/{insp.id}",
            headers=headers,
            json={"observations": "Revised draft observations after second look."},
        )
        assert resp.status_code == 200
        assert resp.get_json()["inspection"]["observations"] == "Revised draft observations after second look."

        # Transition status to reviewed (locked)
        insp.status = "reviewed"
        db.session.commit()

        # Attempt patching locked inspection
        resp_locked = client.patch(
            f"/api/inspections/{insp.id}",
            headers=headers,
            json={"observations": "Attempting illegal post-review overwrite."},
        )
        assert resp_locked.status_code == 422
        assert "Cannot modify" in resp_locked.get_json()["error"]


class TestInspectionImageUploads:
    """Image upload, validation, retrieval, and security test suite."""

    def test_upload_valid_single_and_multiple_images(self, client, inspector_user, db):
        prod = Product(product_code="PRD-IMG-01", name="Part", is_active=True)
        db.session.add(prod)
        db.session.flush()
        batch = Batch(batch_number="BAT-IMG-01", product_id=prod.id)
        db.session.add(batch)
        db.session.flush()
        insp = Inspection(
            product_id=prod.id,
            batch_id=batch.id,
            inspector_id=inspector_user.id,
            status="pending_upload",
        )
        db.session.add(insp)
        db.session.commit()

        headers = get_auth_headers(client, email=inspector_user.email, password="testpass123")

        img1_bytes = create_dummy_image(format="JPEG", color=(255, 0, 0))
        img2_bytes = create_dummy_image(format="PNG", color=(0, 255, 0))

        data = {
            "images": [
                (io.BytesIO(img1_bytes), "inspection_front.jpg"),
                (io.BytesIO(img2_bytes), "inspection_side.png"),
            ]
        }

        resp = client.post(
            f"/api/inspections/{insp.id}/images",
            headers=headers,
            data=data,
            content_type="multipart/form-data",
        )
        assert resp.status_code == 201
        res_json = resp.get_json()
        assert res_json["total_uploaded"] == 2
        assert len(res_json["succeeded"]) == 2
        assert len(res_json["failed"]) == 0

        # Verify inspection status transitioned from pending_upload to pending_review
        updated_insp = db.session.get(Inspection, insp.id)
        assert updated_insp.status == InspectionStatus.PENDING_REVIEW.value

        # Verify images recorded in DB
        db_images = InspectionImage.query.filter_by(inspection_id=insp.id).all()
        assert len(db_images) == 2
        assert all(img.file_size > 0 for img in db_images)
        assert all(len(img.file_hash) == 64 for img in db_images)  # SHA-256 hash length

    def test_reject_corrupt_image(self, client, inspector_user, db):
        prod = Product(product_code="PRD-CORRUPT", name="Part", is_active=True)
        db.session.add(prod)
        db.session.flush()
        batch = Batch(batch_number="BAT-CORRUPT", product_id=prod.id)
        db.session.add(batch)
        db.session.flush()
        insp = Inspection(
            product_id=prod.id,
            batch_id=batch.id,
            inspector_id=inspector_user.id,
            status="pending_upload",
        )
        db.session.add(insp)
        db.session.commit()

        headers = get_auth_headers(client, email=inspector_user.email, password="testpass123")

        # Fake corrupt bytes pretending to be a JPG
        corrupt_bytes = b"NOT_A_REAL_IMAGE_DATA_1234567890"

        data = {"images": [(io.BytesIO(corrupt_bytes), "corrupt.jpg")]}
        resp = client.post(
            f"/api/inspections/{insp.id}/images",
            headers=headers,
            data=data,
            content_type="multipart/form-data",
        )
        assert resp.status_code == 422
        res_json = resp.get_json()
        assert res_json["total_uploaded"] == 0
        assert len(res_json["failed"]) == 1
        assert "not a valid or readable image" in res_json["failed"][0]["error"]

    def test_partial_success_multi_upload(self, client, inspector_user, db):
        prod = Product(product_code="PRD-PARTIAL", name="Part", is_active=True)
        db.session.add(prod)
        db.session.flush()
        batch = Batch(batch_number="BAT-PARTIAL", product_id=prod.id)
        db.session.add(batch)
        db.session.flush()
        insp = Inspection(
            product_id=prod.id,
            batch_id=batch.id,
            inspector_id=inspector_user.id,
            status="pending_upload",
        )
        db.session.add(insp)
        db.session.commit()

        headers = get_auth_headers(client, email=inspector_user.email, password="testpass123")

        good_bytes = create_dummy_image(format="JPEG")
        corrupt_bytes = b"CORRUPT_BYTES"

        data = {
            "images": [
                (io.BytesIO(good_bytes), "good.jpg"),
                (io.BytesIO(corrupt_bytes), "corrupt.png"),
            ]
        }
        resp = client.post(
            f"/api/inspections/{insp.id}/images",
            headers=headers,
            data=data,
            content_type="multipart/form-data",
        )
        assert resp.status_code == 201  # Partial success returns 201 with breakdown
        res_json = resp.get_json()
        assert res_json["total_uploaded"] == 1
        assert len(res_json["succeeded"]) == 1
        assert len(res_json["failed"]) == 1
        assert res_json["succeeded"][0]["original_filename"] == "good.jpg"

    def test_prevent_directory_traversal_filename(self, client, inspector_user, db):
        prod = Product(product_code="PRD-TRAV", name="Part", is_active=True)
        db.session.add(prod)
        db.session.flush()
        batch = Batch(batch_number="BAT-TRAV", product_id=prod.id)
        db.session.add(batch)
        db.session.flush()
        insp = Inspection(
            product_id=prod.id,
            batch_id=batch.id,
            inspector_id=inspector_user.id,
            status="pending_upload",
        )
        db.session.add(insp)
        db.session.commit()

        headers = get_auth_headers(client, email=inspector_user.email, password="testpass123")

        img_bytes = create_dummy_image(format="JPEG")
        traversal_filename = "../../../etc/evil.jpg"

        data = {"images": [(io.BytesIO(img_bytes), traversal_filename)]}
        resp = client.post(
            f"/api/inspections/{insp.id}/images",
            headers=headers,
            data=data,
            content_type="multipart/form-data",
        )
        assert resp.status_code == 201
        uploaded = resp.get_json()["succeeded"][0]
        # Filename is sanitized to base filename
        assert ".." not in uploaded["original_filename"]
        assert "/" not in uploaded["original_filename"]

    def test_secure_image_retrieval_and_cross_inspection_isolation(
        self, client, inspector_user, supervisor_user, db
    ):
        prod = Product(product_code="PRD-RET", name="Part", is_active=True)
        db.session.add(prod)
        db.session.flush()
        batch = Batch(batch_number="BAT-RET", product_id=prod.id)
        db.session.add(batch)
        db.session.flush()

        insp1 = Inspection(product_id=prod.id, batch_id=batch.id, inspector_id=inspector_user.id)
        insp2 = Inspection(product_id=prod.id, batch_id=batch.id, inspector_id=supervisor_user.id)
        db.session.add_all([insp1, insp2])
        db.session.commit()

        headers = get_auth_headers(client, email=inspector_user.email, password="testpass123")

        # Upload image to insp1
        img_bytes = create_dummy_image(format="JPEG")
        data = {"images": [(io.BytesIO(img_bytes), "sample.jpg")]}
        upload_resp = client.post(
            f"/api/inspections/{insp1.id}/images",
            headers=headers,
            data=data,
            content_type="multipart/form-data",
        )
        image_id = upload_resp.get_json()["succeeded"][0]["id"]

        # Valid fetch from insp1
        fetch_resp = client.get(f"/api/inspections/{insp1.id}/images/{image_id}", headers=headers)
        assert fetch_resp.status_code == 200
        assert fetch_resp.headers["Content-Type"] == "image/jpeg"
        assert fetch_resp.headers["X-Content-Type-Options"] == "nosniff"
        assert len(fetch_resp.data) == len(img_bytes)

        # Cross-inspection isolation: attempt to fetch image_id via insp2 returns 404
        cross_resp = client.get(f"/api/inspections/{insp2.id}/images/{image_id}", headers=headers)
        assert cross_resp.status_code == 404
