"""Phase 1 End-to-End Workflow Tests.

Verifies:
1. Human review submission (confirm, correct, no_defect, needs_more_evidence)
2. Defect creation and actionable CAPA assignment with owner & target date
3. CAPA evidence upload and authenticated evidence file retrieval
4. Reinspection linkage with reinspection_of_id retaining full lineage
5. Resolution/closure and reopening without erasing history
"""

import io
from datetime import date
from PIL import Image

from backend.extensions import db
from backend.models.user import User, UserRole
from backend.models.product import Product
from backend.models.batch import Batch, BatchStatus
from backend.models.inspection import Inspection, InspectionStatus
from backend.models.defect import Defect, DefectStatus, DefectSeverity
from backend.models.corrective_action import CorrectiveAction, ActionStatus


from backend.tests import get_auth_headers


def _create_sample_png() -> io.BytesIO:
    img = Image.new("RGB", (64, 64), color=(73, 109, 137))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf


def test_phase1_full_workflow(client, db, inspector_user, supervisor_user, quality_manager_user):
    # Setup roles
    inspector_headers = get_auth_headers(client, email=inspector_user.email, password="testpass123")
    supervisor_headers = get_auth_headers(client, email=supervisor_user.email, password="testpass123")
    qm_headers = get_auth_headers(client, email=quality_manager_user.email, password="testpass123")

    # 1. Create product and batch
    prod_res = client.post(
        "/api/products",
        headers=qm_headers,
        json={"product_code": "PH1-PROD", "name": "Phase 1 Test Product"},
    )
    assert prod_res.status_code == 201
    prod_id = prod_res.get_json()["product"]["id"]

    batch_res = client.post(
        "/api/batches",
        headers=qm_headers,
        json={
            "batch_number": "PH1-LOT-001",
            "product_id": prod_id,
            "quantity": 10,
            "status": "in_production",
        },
    )
    assert batch_res.status_code == 201
    batch_id = batch_res.get_json()["batch"]["id"]

    # 2. Inspector creates inspection intake
    insp_res = client.post(
        "/api/inspections",
        headers=inspector_headers,
        json={
            "product_id": prod_id,
            "batch_id": batch_id,
            "sample_reference": "Sample Slot #001",
            "quantity": 5,
        },
    )
    assert insp_res.status_code == 201
    insp_id = insp_res.get_json()["inspection"]["id"]

    # 3. Upload evidence image
    img_data = {
        "file": (_create_sample_png(), "item_001.png"),
        "sample_type": "item",
    }
    upload_res = client.post(
        f"/api/inspections/{insp_id}/images",
        headers=inspector_headers,
        data=img_data,
        content_type="multipart/form-data",
    )
    assert upload_res.status_code == 201

    # 4. Human Review: Inspector confirms defect
    review_res = client.post(
        "/api/reviews",
        headers=inspector_headers,
        json={
            "inspection_id": insp_id,
            "decision": "confirm",
            "defect_category": "surface_scratch",
            "defect_severity": "major",
            "defect_description": "Detected scratch near corner",
            "item_number": 1,
            "comments": "Verified under 10x magnification",
        },
    )
    assert review_res.status_code == 201
    review_data = review_res.get_json()
    assert review_data["review"]["decision"] == "confirm"
    assert "defect" in review_data
    defect_id = review_data["defect"]["id"]
    assert review_data["defect"]["defect_category"] == "surface_scratch"
    assert review_data["defect"]["status"] == "open"
    assert review_data["defect"]["item_number"] == 1

    # 5. Inspection detail reflects review and defect
    detail_res = client.get(f"/api/inspections/{insp_id}", headers=inspector_headers)
    assert detail_res.status_code == 200
    detail_data = detail_res.get_json()["inspection"]
    assert detail_data["status"] == "reviewed"
    assert len(detail_data["reviews"]) >= 1
    assert len(detail_data["defects"]) >= 1

    # 6. Make confirmed defect actionable (CAPA creation)
    # Inspector cannot create CAPA
    forbidden_res = client.post(
        "/api/corrective-actions",
        headers=inspector_headers,
        json={"defect_id": defect_id, "notes": "Unauthorized attempt"},
    )
    assert forbidden_res.status_code == 403

    # Supervisor creates CAPA
    assignees_res = client.get("/api/users/assignable", headers=supervisor_headers)
    assert assignees_res.status_code == 200
    assignees = assignees_res.get_json()["users"]
    assert len(assignees) >= 1
    owner_id = assignees[0]["id"]

    capa_res = client.post(
        "/api/corrective-actions",
        headers=supervisor_headers,
        json={
            "defect_id": defect_id,
            "owner_id": owner_id,
            "target_date": "2026-11-01",
            "notes": "Recalibrate optical camera and buff surface finish",
        },
    )
    assert capa_res.status_code == 201
    capa_id = capa_res.get_json()["corrective_action"]["id"]
    assert capa_res.get_json()["corrective_action"]["status"] == "open"

    # 7. Upload repair evidence
    evidence_img = (_create_sample_png(), "repaired_surface.png")
    ev_res = client.post(
        f"/api/corrective-actions/{capa_id}/evidence",
        headers=supervisor_headers,
        data={
            "file": evidence_img,
            "description": "Surface polished and micro-abrasion removed",
            "notes": "Post-repair optical check clear",
        },
        content_type="multipart/form-data",
    )
    assert ev_res.status_code == 201
    evidence_id = ev_res.get_json()["evidence"]["id"]

    # Verify CAPA auto-advanced to in_progress
    get_capa_res = client.get(f"/api/corrective-actions/{capa_id}", headers=supervisor_headers)
    assert get_capa_res.status_code == 200
    assert get_capa_res.get_json()["corrective_action"]["status"] == "in_progress"
    assert len(get_capa_res.get_json()["corrective_action"]["evidence"]) == 1

    # Verify repair evidence file retrieval
    file_res = client.get(
        f"/api/corrective-actions/{capa_id}/evidence/{evidence_id}/file",
        headers=supervisor_headers,
    )
    assert file_res.status_code == 200
    assert len(file_res.data) > 0

    # 8. Start follow-up reinspection linked to original inspection
    reinsp_res = client.post(
        "/api/inspections",
        headers=inspector_headers,
        json={
            "reinspection_of_id": insp_id,
            "sample_reference": "Follow-up Post-Buffing",
            "observations": "Verifying CAPA execution on item #1",
            "quantity": 1,
        },
    )
    assert reinsp_res.status_code == 201
    reinsp_id = reinsp_res.get_json()["inspection"]["id"]
    assert reinsp_res.get_json()["inspection"]["reinspection_of_id"] == insp_id

    # Check original inspection retains link to reinspection
    orig_insp_res = client.get(f"/api/inspections/{insp_id}", headers=inspector_headers)
    assert orig_insp_res.status_code == 200
    orig_data = orig_insp_res.get_json()["inspection"]
    assert len(orig_data["reinspections"]) >= 1
    assert orig_data["reinspections"][0]["id"] == reinsp_id

    # Check follow-up reinspection retains link to parent
    reinsp_detail = client.get(f"/api/inspections/{reinsp_id}", headers=inspector_headers)
    assert reinsp_detail.status_code == 200
    assert reinsp_detail.get_json()["inspection"]["reinspection_of"]["id"] == insp_id

    # 9. Support Closure & Reopening
    # Close CAPA and Defect
    patch_capa = client.patch(
        f"/api/corrective-actions/{capa_id}",
        headers=supervisor_headers,
        json={"status": "closed", "completion_notes": "Repaired and passed reinspection"},
    )
    assert patch_capa.status_code == 200
    assert patch_capa.get_json()["corrective_action"]["status"] == "closed"

    patch_defect = client.patch(
        f"/api/defects/{defect_id}",
        headers=supervisor_headers,
        json={"status": "closed"},
    )
    assert patch_defect.status_code == 200
    assert patch_defect.get_json()["defect"]["status"] == "closed"

    # Test Reopening (e.g. recurrence or contested closure)
    reopen_defect = client.patch(
        f"/api/defects/{defect_id}",
        headers=supervisor_headers,
        json={"status": "reopened"},
    )
    assert reopen_defect.status_code == 200
    assert reopen_defect.get_json()["defect"]["status"] == "reopened"

    reopen_capa = client.patch(
        f"/api/corrective-actions/{capa_id}",
        headers=supervisor_headers,
        json={"status": "reopened", "notes": "Recurrence observed under thermal stress"},
    )
    assert reopen_capa.status_code == 200
    assert reopen_capa.get_json()["corrective_action"]["status"] == "reopened"


def test_review_decisions_and_reinspection_inheritance(client, db, inspector_user, quality_manager_user):
    inspector_headers = get_auth_headers(client, email=inspector_user.email, password="testpass123")
    qm_headers = get_auth_headers(client, email=quality_manager_user.email, password="testpass123")

    # 1. Setup product & batch
    prod_res = client.post(
        "/api/products",
        headers=qm_headers,
        json={"product_code": "PH1-P2", "name": "Review Decision Test"},
    )
    prod_id = prod_res.get_json()["product"]["id"]

    batch_res = client.post(
        "/api/batches",
        headers=qm_headers,
        json={"batch_number": "PH1-LOT-002", "product_id": prod_id, "quantity": 10},
    )
    batch_id = batch_res.get_json()["batch"]["id"]

    # 2. Needs more evidence review
    insp1 = client.post(
        "/api/inspections",
        headers=inspector_headers,
        json={"product_id": prod_id, "batch_id": batch_id, "quantity": 1},
    ).get_json()["inspection"]

    rev_nme = client.post(
        "/api/reviews",
        headers=inspector_headers,
        json={
            "inspection_id": insp1["id"],
            "decision": "needs_more_evidence",
            "comments": "Lighting too dark on optical sensor",
        },
    )
    assert rev_nme.status_code == 201
    insp1_updated = client.get(f"/api/inspections/{insp1['id']}", headers=inspector_headers).get_json()["inspection"]
    assert insp1_updated["status"] == "needs_more_evidence"

    # 3. No defect review
    insp2 = client.post(
        "/api/inspections",
        headers=inspector_headers,
        json={"product_id": prod_id, "batch_id": batch_id, "quantity": 1},
    ).get_json()["inspection"]

    rev_nd = client.post(
        "/api/reviews",
        headers=inspector_headers,
        json={
            "inspection_id": insp2["id"],
            "decision": "no_defect",
            "comments": "Confirmed clean pass by inspector",
        },
    )
    assert rev_nd.status_code == 201
    assert "defect" not in rev_nd.get_json()
    insp2_updated = client.get(f"/api/inspections/{insp2['id']}", headers=inspector_headers).get_json()["inspection"]
    assert insp2_updated["status"] == "reviewed"
    assert len(insp2_updated["defects"]) == 0

    # 4. Correct model suggestion review
    insp3 = client.post(
        "/api/inspections",
        headers=inspector_headers,
        json={"product_id": prod_id, "batch_id": batch_id, "quantity": 1},
    ).get_json()["inspection"]

    rev_correct = client.post(
        "/api/reviews",
        headers=inspector_headers,
        json={
            "inspection_id": insp3["id"],
            "decision": "correct",
            "confirmed_class": "dimensional_warp",
            "defect_category": "warp",
            "defect_severity": "critical",
            "defect_description": "AI predicted good, but human review identified severe warping",
            "comments": "Correction applied after caliper check",
        },
    )
    assert rev_correct.status_code == 201
    corr_json = rev_correct.get_json()
    assert corr_json["defect"]["defect_category"] == "warp"
    assert corr_json["defect"]["severity"] == "critical"

    # 5. Reinspection inherits product & batch automatically
    reinsp = client.post(
        "/api/inspections",
        headers=inspector_headers,
        json={
            "reinspection_of_id": insp3["id"],
            "quantity": 1,
        },
    )
    assert reinsp.status_code == 201
    reinsp_data = reinsp.get_json()["inspection"]
    assert reinsp_data["product_id"] == prod_id
    assert reinsp_data["batch_id"] == batch_id
    assert reinsp_data["reinspection_of_id"] == insp3["id"]

    # Filter inspections by reinspection_of_id
    filter_res = client.get(
        f"/api/inspections?reinspection_of_id={insp3['id']}",
        headers=inspector_headers,
    )
    assert filter_res.status_code == 200
    assert len(filter_res.get_json()["inspections"]) == 1

