"""Tests for ML inference integration with Flask backend (Phase ML-6).

Validates:
- Successful inference and MLResult persistence.
- Failed inference handling and image retention (no rollback of valid uploads).
- Multiple image uploads with mixed ML success/failure per-image transaction isolation.
- Error sanitization (no internal paths or tracebacks exposed).
- Preservation of existing upload response structure and permission enforcement.
- Ensuring no automated human reviews or batch releases are created from predictions.
- Mocking of predict_image so tests do not depend on heavyweight GPU/model checkpoints.
"""

import io
from unittest.mock import patch
from PIL import Image

from backend.tests import get_auth_headers
from backend.models.product import Product
from backend.models.batch import Batch
from backend.models.inspection import Inspection, InspectionStatus
from backend.models.inspection_image import InspectionImage, ImageProcessingState
from backend.models.ml_result import MLResult, MLResultStatus
from backend.models.human_review import HumanReview
from backend.services.ml_service import process_inspection_image_ml


def create_dummy_image(format="JPEG", size=(100, 100), color=(255, 0, 0)) -> bytes:
    """Helper to generate valid image bytes in memory."""
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=color)
    img.save(buf, format=format)
    return buf.getvalue()


class TestMLBackendIntegration:
    """Integration test suite for ML inference within Flask inspection flow."""

    def test_single_image_upload_with_successful_inference(
        self, client, inspector_user, db
    ):
        prod = Product(product_code="PRD-ML-01", name="Casting Part A", is_active=True)
        db.session.add(prod)
        db.session.flush()

        batch = Batch(
            batch_number="BAT-ML-01",
            product_id=prod.id,
            status="under_inspection",
        )
        db.session.add(batch)
        db.session.flush()

        insp = Inspection(
            product_id=prod.id,
            batch_id=batch.id,
            inspector_id=inspector_user.id,
            status=InspectionStatus.PENDING_UPLOAD.value,
        )
        db.session.add(insp)
        db.session.commit()

        mock_pred = {
            "status": "success",
            "predicted_class": "defective",
            "scores": {"good": 0.0812, "defective": 0.9188},
            "score_type": "sigmoid_score",
            "model_name": "efficientnet_b0_casting_binary",
            "model_version": "v1.0.0",
            "processing_duration_ms": 35.4,
            "threshold": 0.38,
            "error_code": None,
            "error_details": None,
        }

        headers = get_auth_headers(
            client, email=inspector_user.email, password="testpass123"
        )
        img_bytes = create_dummy_image(format="JPEG", color=(100, 150, 200))
        data = {"images": [(io.BytesIO(img_bytes), "casting_front.jpg")]}

        with patch(
            "backend.services.ml_service.predict_image", return_value=mock_pred
        ) as mock_predict:
            resp = client.post(
                f"/api/inspections/{insp.id}/images",
                headers=headers,
                data=data,
                content_type="multipart/form-data",
            )

        assert resp.status_code == 201
        res_json = resp.get_json()

        assert res_json["total_uploaded"] == 1
        assert len(res_json["succeeded"]) == 1
        assert len(res_json["failed"]) == 0

        # Check response backward-compatibility & ML payload
        succeeded_item = res_json["succeeded"][0]
        assert succeeded_item["original_filename"] == "casting_front.jpg"
        assert succeeded_item["processing_state"] == ImageProcessingState.PROCESSED.value
        assert succeeded_item["failure_reason"] is None
        assert "ml_result" in succeeded_item
        ml_data = succeeded_item["ml_result"]
        assert ml_data["status"] == MLResultStatus.SUCCESS.value
        assert ml_data["predicted_class"] == "defective"
        assert ml_data["raw_scores"] == {"good": 0.0812, "defective": 0.9188}
        assert ml_data["processing_duration_ms"] == 35
        assert ml_data["model_name"] == "efficientnet_b0_casting_binary"
        assert ml_data["model_version"] == "v1.0.0"
        assert ml_data["error_details"] is None

        # Check DB persistence
        db_image = db.session.get(InspectionImage, succeeded_item["id"])
        assert db_image is not None
        assert db_image.processing_state == ImageProcessingState.PROCESSED.value

        db_ml_result = MLResult.query.filter_by(
            inspection_id=insp.id, image_id=db_image.id
        ).first()
        assert db_ml_result is not None
        assert db_ml_result.status == MLResultStatus.SUCCESS.value
        assert db_ml_result.predicted_class == "defective"
        assert db_ml_result.raw_scores == {"good": 0.0812, "defective": 0.9188}
        assert db_ml_result.processing_duration_ms == 35
        assert db_ml_result.model_name == "efficientnet_b0_casting_binary"
        assert db_ml_result.model_version == "v1.0.0"
        assert db_ml_result.error_details is None

        # Check mock was called with secure filesystem path
        mock_predict.assert_called_once()
        called_path = mock_predict.call_args[0][0]
        assert "inspections" in str(called_path)

        # Confirm inspection state transitioned to pending_review
        updated_insp = db.session.get(Inspection, insp.id)
        assert updated_insp.status == InspectionStatus.PENDING_REVIEW.value

        # Confirm NO automatic HumanReview decision was created
        reviews = HumanReview.query.filter_by(inspection_id=insp.id).all()
        assert len(reviews) == 0

        # Confirm batch status was not automatically released or altered
        updated_batch = db.session.get(Batch, batch.id)
        assert updated_batch.status == "under_inspection"

    def test_image_upload_with_failed_inference_retains_image(
        self, client, inspector_user, db
    ):
        prod = Product(product_code="PRD-ML-02", name="Casting Part B", is_active=True)
        db.session.add(prod)
        db.session.flush()

        batch = Batch(
            batch_number="BAT-ML-02", product_id=prod.id, status="under_inspection"
        )
        db.session.add(batch)
        db.session.flush()

        insp = Inspection(
            product_id=prod.id,
            batch_id=batch.id,
            inspector_id=inspector_user.id,
            status=InspectionStatus.PENDING_UPLOAD.value,
        )
        db.session.add(insp)
        db.session.commit()

        # Simulated ML failure (e.g., missing checkpoint)
        mock_pred = {
            "status": "failed",
            "predicted_class": None,
            "scores": None,
            "score_type": "sigmoid_score",
            "model_name": "efficientnet_b0_casting_binary",
            "model_version": "v1.0.0",
            "processing_duration_ms": 12.0,
            "threshold": 0.38,
            "error_code": "CHECKPOINT_NOT_FOUND",
            "error_details": "Model checkpoint file was not found or is unreadable.",
        }

        headers = get_auth_headers(
            client, email=inspector_user.email, password="testpass123"
        )
        img_bytes = create_dummy_image(format="JPEG")
        data = {"images": [(io.BytesIO(img_bytes), "sample_ok.jpg")]}

        with patch(
            "backend.services.ml_service.predict_image", return_value=mock_pred
        ):
            resp = client.post(
                f"/api/inspections/{insp.id}/images",
                headers=headers,
                data=data,
                content_type="multipart/form-data",
            )

        # Upload itself succeeded (201) because image is valid and securely stored
        assert resp.status_code == 201
        res_json = resp.get_json()

        assert res_json["total_uploaded"] == 1
        succeeded_item = res_json["succeeded"][0]
        assert succeeded_item["processing_state"] == ImageProcessingState.FAILED.value
        assert (
            succeeded_item["failure_reason"]
            == "Model checkpoint file was not found or is unreadable."
        )

        ml_data = succeeded_item["ml_result"]
        assert ml_data["status"] == MLResultStatus.FAILED.value
        assert ml_data["predicted_class"] is None
        assert (
            ml_data["error_details"]
            == "Model checkpoint file was not found or is unreadable."
        )

        # Confirm DB records: image is retained and NOT rolled back
        db_image = db.session.get(InspectionImage, succeeded_item["id"])
        assert db_image is not None
        assert db_image.processing_state == ImageProcessingState.FAILED.value

        db_ml_result = MLResult.query.filter_by(
            inspection_id=insp.id, image_id=db_image.id
        ).first()
        assert db_ml_result is not None
        assert db_ml_result.status == MLResultStatus.FAILED.value
        assert db_ml_result.predicted_class is None
        assert (
            db_ml_result.error_details
            == "Model checkpoint file was not found or is unreadable."
        )

    def test_multiple_images_upload_with_isolated_per_image_results(
        self, client, inspector_user, db
    ):
        prod = Product(product_code="PRD-ML-03", name="Casting Part C", is_active=True)
        db.session.add(prod)
        db.session.flush()

        batch = Batch(
            batch_number="BAT-ML-03", product_id=prod.id, status="under_inspection"
        )
        db.session.add(batch)
        db.session.flush()

        insp = Inspection(
            product_id=prod.id,
            batch_id=batch.id,
            inspector_id=inspector_user.id,
            status=InspectionStatus.PENDING_UPLOAD.value,
        )
        db.session.add(insp)
        db.session.commit()

        # Side effect: first image succeeds, second image fails inference
        results = [
            {
                "status": "success",
                "predicted_class": "good",
                "scores": {"good": 0.9412, "defective": 0.0588},
                "score_type": "sigmoid_score",
                "model_name": "efficientnet_b0_casting_binary",
                "model_version": "v1.0.0",
                "processing_duration_ms": 28.0,
                "threshold": 0.38,
                "error_code": None,
                "error_details": None,
            },
            {
                "status": "failed",
                "predicted_class": None,
                "scores": None,
                "score_type": "sigmoid_score",
                "model_name": "efficientnet_b0_casting_binary",
                "model_version": "v1.0.0",
                "processing_duration_ms": 10.0,
                "threshold": 0.38,
                "error_code": "INFERENCE_ERROR",
                "error_details": "Neural network computation failed.",
            },
        ]

        headers = get_auth_headers(
            client, email=inspector_user.email, password="testpass123"
        )
        img1_bytes = create_dummy_image(format="JPEG", color=(10, 20, 30))
        img2_bytes = create_dummy_image(format="PNG", color=(40, 50, 60))

        data = {
            "images": [
                (io.BytesIO(img1_bytes), "image_good.jpg"),
                (io.BytesIO(img2_bytes), "image_err.png"),
            ]
        }

        with patch(
            "backend.services.ml_service.predict_image", side_effect=results
        ):
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

        img1_data = res_json["succeeded"][0]
        img2_data = res_json["succeeded"][1]

        # Image 1 succeeded
        assert img1_data["processing_state"] == ImageProcessingState.PROCESSED.value
        assert img1_data["ml_result"]["status"] == MLResultStatus.SUCCESS.value
        assert img1_data["ml_result"]["predicted_class"] == "good"

        # Image 2 failed ML, but upload and record are preserved
        assert img2_data["processing_state"] == ImageProcessingState.FAILED.value
        assert img2_data["ml_result"]["status"] == MLResultStatus.FAILED.value

        # Both MLResult records exist in DB
        ml_records = MLResult.query.filter_by(inspection_id=insp.id).order_by(
            MLResult.id.asc()
        ).all()
        assert len(ml_records) == 2
        assert ml_records[0].status == MLResultStatus.SUCCESS.value
        assert ml_records[1].status == MLResultStatus.FAILED.value

    def test_ml_inference_unexpected_exception_is_contained(
        self, client, inspector_user, db
    ):
        prod = Product(product_code="PRD-ML-04", name="Casting Part D", is_active=True)
        db.session.add(prod)
        db.session.flush()

        batch = Batch(
            batch_number="BAT-ML-04", product_id=prod.id, status="under_inspection"
        )
        db.session.add(batch)
        db.session.flush()

        insp = Inspection(
            product_id=prod.id,
            batch_id=batch.id,
            inspector_id=inspector_user.id,
            status=InspectionStatus.PENDING_UPLOAD.value,
        )
        db.session.add(insp)
        db.session.commit()

        headers = get_auth_headers(
            client, email=inspector_user.email, password="testpass123"
        )
        img_bytes = create_dummy_image(format="JPEG")
        data = {"images": [(io.BytesIO(img_bytes), "crash.jpg")]}

        # Mock predict_image raising a raw unhandled exception with internal paths
        with patch(
            "backend.services.ml_service.predict_image",
            side_effect=RuntimeError("CUDA out of memory at C:\\internal\\cuda\\ops.cu:140"),
        ):
            resp = client.post(
                f"/api/inspections/{insp.id}/images",
                headers=headers,
                data=data,
                content_type="multipart/form-data",
            )

        assert resp.status_code == 201
        res_json = resp.get_json()
        assert res_json["total_uploaded"] == 1

        succeeded_item = res_json["succeeded"][0]
        assert succeeded_item["processing_state"] == ImageProcessingState.FAILED.value

        # Internal path MUST NOT be exposed in API response
        assert "C:\\internal" not in succeeded_item["failure_reason"]
        assert "cuda" not in succeeded_item["failure_reason"]
        assert "C:\\internal" not in succeeded_item["ml_result"]["error_details"]

        # MLResult persisted as failed
        db_ml_result = MLResult.query.filter_by(inspection_id=insp.id).first()
        assert db_ml_result is not None
        assert db_ml_result.status == MLResultStatus.FAILED.value

    def test_get_inspection_includes_ml_results_in_details(
        self, client, inspector_user, db
    ):
        prod = Product(product_code="PRD-ML-05", name="Casting Part E", is_active=True)
        db.session.add(prod)
        db.session.flush()

        batch = Batch(
            batch_number="BAT-ML-05", product_id=prod.id, status="under_inspection"
        )
        db.session.add(batch)
        db.session.flush()

        insp = Inspection(
            product_id=prod.id,
            batch_id=batch.id,
            inspector_id=inspector_user.id,
            status=InspectionStatus.PENDING_UPLOAD.value,
        )
        db.session.add(insp)
        db.session.commit()

        mock_pred = {
            "status": "success",
            "predicted_class": "good",
            "scores": {"good": 0.98, "defective": 0.02},
            "score_type": "sigmoid_score",
            "model_name": "efficientnet_b0_casting_binary",
            "model_version": "v1.0.0",
            "processing_duration_ms": 20.0,
            "threshold": 0.38,
            "error_code": None,
            "error_details": None,
        }

        headers = get_auth_headers(
            client, email=inspector_user.email, password="testpass123"
        )
        img_bytes = create_dummy_image(format="JPEG")
        data = {"images": [(io.BytesIO(img_bytes), "detail_check.jpg")]}

        with patch(
            "backend.services.ml_service.predict_image", return_value=mock_pred
        ):
            client.post(
                f"/api/inspections/{insp.id}/images",
                headers=headers,
                data=data,
                content_type="multipart/form-data",
            )

        # Fetch inspection details
        resp = client.get(f"/api/inspections/{insp.id}", headers=headers)
        assert resp.status_code == 200
        insp_data = resp.get_json()["inspection"]

        assert "images" in insp_data
        assert len(insp_data["images"]) == 1
        assert "ml_result" in insp_data["images"][0]
        assert insp_data["images"][0]["ml_result"]["predicted_class"] == "good"

        assert "ml_results" in insp_data
        assert len(insp_data["ml_results"]) == 1
        assert insp_data["ml_results"][0]["predicted_class"] == "good"

    def test_upload_permissions_enforced(self, client, db):
        # 1. Unauthenticated request rejected
        resp_unauth = client.post("/api/inspections/1/images")
        assert resp_unauth.status_code == 401

    def test_direct_ml_service_file_missing_on_disk(self, client, inspector_user, db):
        prod = Product(product_code="PRD-ML-06", name="Direct Test", is_active=True)
        db.session.add(prod)
        db.session.flush()
        batch = Batch(batch_number="BAT-ML-06", product_id=prod.id)
        db.session.add(batch)
        db.session.flush()
        insp = Inspection(
            product_id=prod.id,
            batch_id=batch.id,
            inspector_id=inspector_user.id,
        )
        db.session.add(insp)
        db.session.flush()

        # Image record whose file doesn't actually exist on disk
        fake_img = InspectionImage(
            inspection_id=insp.id,
            storage_path="inspections/nonexistent/fake.jpg",
            original_filename="fake.jpg",
            content_type="image/jpeg",
            file_size=100,
            file_hash="abc123hash",
            uploaded_by_id=inspector_user.id,
        )
        db.session.add(fake_img)
        db.session.flush()

        res = process_inspection_image_ml(fake_img)
        assert res.status == MLResultStatus.FAILED.value
        assert fake_img.processing_state == ImageProcessingState.FAILED.value
        assert "missing or inaccessible" in res.error_details
