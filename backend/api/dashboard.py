"""Dashboard API — KPI aggregates for the Command Center."""

from flask import Blueprint, jsonify
from sqlalchemy import func

from backend.extensions import db
from backend.models.inspection import Inspection, InspectionStatus
from backend.models.batch import Batch, BatchStatus
from backend.models.defect import Defect, DefectSeverity
from backend.models.product import Product
from backend.middleware.permissions import require_permission

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")


@dashboard_bp.route("", methods=["GET"])
@require_permission("dashboard.view")
def get_dashboard(current_user):
    """Return KPI aggregates for the Command Center.

    Returns:
      - inspection counts by status
      - batch pipeline counts by status
      - defect counts by severity
      - first pass yield (inspections with no defects / total reviewed)
      - recent inspections (last 10)
    """
    # --- Inspection counts ---
    inspection_counts = dict(
        db.session.query(Inspection.status, func.count(Inspection.id))
        .group_by(Inspection.status)
        .all()
    )
    total_inspections = sum(inspection_counts.values())

    # --- First Pass Yield ---
    total_reviewed = inspection_counts.get(InspectionStatus.REVIEWED.value, 0)
    # Inspections that are reviewed AND have zero defects
    inspections_with_defects = (
        db.session.query(func.count(func.distinct(Defect.inspection_id)))
        .scalar() or 0
    )
    passed = max(0, total_reviewed - inspections_with_defects)
    fpy = round((passed / total_reviewed * 100), 1) if total_reviewed > 0 else None

    # --- Batch pipeline ---
    batch_counts = dict(
        db.session.query(Batch.status, func.count(Batch.id))
        .group_by(Batch.status)
        .all()
    )
    total_batches = sum(batch_counts.values())

    # --- Defect counts by severity ---
    defect_counts = dict(
        db.session.query(Defect.severity, func.count(Defect.id))
        .group_by(Defect.severity)
        .all()
    )
    total_defects = sum(defect_counts.values())

    # --- Active products ---
    active_products = db.session.query(func.count(Product.id)).filter_by(is_active=True).scalar() or 0

    # --- Recent inspections (last 10) ---
    recent = (
        Inspection.query
        .order_by(Inspection.created_at.desc())
        .limit(10)
        .all()
    )

    return jsonify({
        "fpy_percent": fpy,
        "inspections": {
            "total": total_inspections,
            "by_status": inspection_counts,
        },
        "batches": {
            "total": total_batches,
            "by_status": batch_counts,
            "on_hold": batch_counts.get(BatchStatus.ON_HOLD.value, 0),
            "released": batch_counts.get(BatchStatus.RELEASED.value, 0),
            "under_inspection": batch_counts.get(BatchStatus.UNDER_INSPECTION.value, 0),
        },
        "defects": {
            "total": total_defects,
            "by_severity": defect_counts,
            "critical": defect_counts.get(DefectSeverity.CRITICAL.value, 0),
            "high": defect_counts.get(DefectSeverity.HIGH.value, 0),
        },
        "active_products": active_products,
        "recent_inspections": [i.to_dict(include_details=True) for i in recent],
    }), 200
