"""Human review endpoints — confirm, correct, or challenge AI suggestions."""

from flask import Blueprint, jsonify, request
from sqlalchemy import or_

from backend.extensions import db
from backend.models.human_review import HumanReview, ReviewDecision
from backend.models.inspection import Inspection, InspectionStatus
from backend.models.ml_result import MLResult
from backend.models.defect import Defect, DefectSeverity, DefectStatus
from backend.models.user import UserRole
from backend.middleware.permissions import require_permission
from backend.middleware.errors import NotFoundError, ValidationError, ForbiddenError
from backend.services.audit_service import log_audit_event

reviews_bp = Blueprint("reviews", __name__, url_prefix="/api/reviews")

VALID_DECISIONS = {d.value for d in ReviewDecision}


@reviews_bp.route("", methods=["GET"])
@require_permission("review.view")
def list_reviews(current_user):
    """List human reviews with optional filters.

    Query params: inspection_id, reviewer_id, decision, page, per_page
    """
    inspection_id = request.args.get("inspection_id", type=int)
    reviewer_id = request.args.get("reviewer_id", type=int)
    decision = request.args.get("decision", "").strip().lower()
    page = max(1, request.args.get("page", 1, type=int))
    per_page = min(100, max(1, request.args.get("per_page", 20, type=int)))

    query = HumanReview.query

    if inspection_id:
        query = query.filter_by(inspection_id=inspection_id)
    if reviewer_id:
        query = query.filter_by(reviewer_id=reviewer_id)
    if decision and decision != "all":
        query = query.filter_by(decision=decision)

    total = query.count()
    reviews = (
        query.order_by(HumanReview.review_timestamp.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    return jsonify({
        "reviews": [r.to_dict() for r in reviews],
        "total": total,
        "page": page,
        "per_page": per_page,
        "total_pages": max(1, (total + per_page - 1) // per_page),
    }), 200


@reviews_bp.route("/<int:review_id>", methods=["GET"])
@require_permission("review.view")
def get_review(review_id, current_user):
    review = db.session.get(HumanReview, review_id)
    if not review:
        raise NotFoundError("Review not found")
    return jsonify({"review": review.to_dict()}), 200


@reviews_bp.route("", methods=["POST"])
@require_permission("review.create")
def create_review(current_user):
    """Submit a human review for an inspection.

    Body: {
        inspection_id,
        decision,           # confirm | correct | no_defect | needs_more_evidence
        ml_result_id?,
        confirmed_class?,   # required when decision == 'correct'
        comments?,
        # defect fields (required when decision is confirm or correct)
        defect_category?,
        defect_severity?,
        defect_description?
    }

    Side effects:
    - decision == 'confirm' or 'correct'  → creates a Defect record
    - decision == 'needs_more_evidence'   → sets inspection back to needs_more_evidence
    - any decision                        → sets inspection to 'reviewed'
    """
    data = request.get_json(silent=True)
    if not data:
        raise ValidationError("JSON body required")

    inspection_id = data.get("inspection_id")
    decision = (data.get("decision") or "").strip().lower()
    ml_result_id = data.get("ml_result_id")
    confirmed_class = (data.get("confirmed_class") or "").strip() or None
    comments = (data.get("comments") or "").strip() or None
    defect_category = (data.get("defect_category") or "").strip() or None
    defect_severity = (data.get("defect_severity") or DefectSeverity.MEDIUM.value).strip().lower()
    defect_description = (data.get("defect_description") or "").strip() or None

    errors: dict[str, str] = {}

    if not inspection_id:
        errors["inspection_id"] = "Inspection ID is required"
    else:
        inspection = db.session.get(Inspection, inspection_id)
        if not inspection:
            errors["inspection_id"] = f"Inspection {inspection_id} not found"

    if decision not in VALID_DECISIONS:
        errors["decision"] = f"Decision must be one of: {', '.join(sorted(VALID_DECISIONS))}"

    if decision == ReviewDecision.CORRECT.value and not confirmed_class:
        errors["confirmed_class"] = "confirmed_class is required when decision is 'correct'"

    if decision in {ReviewDecision.CONFIRM.value, ReviewDecision.CORRECT.value}:
        if not defect_category:
            errors["defect_category"] = "defect_category is required when confirming a defect"
        valid_severities = {s.value for s in DefectSeverity}
        if defect_severity not in valid_severities:
            errors["defect_severity"] = f"Severity must be one of: {', '.join(sorted(valid_severities))}"

    if errors:
        raise ValidationError("Validation failed", details=errors)

    # Validate ml_result belongs to this inspection if provided
    if ml_result_id:
        ml_result = db.session.get(MLResult, ml_result_id)
        if not ml_result or ml_result.inspection_id != inspection_id:
            raise ValidationError("ml_result_id does not belong to this inspection")

    # Inspectors can only review their own inspections
    if current_user.role == UserRole.INSPECTOR.value and inspection.inspector_id != current_user.id:
        raise ForbiddenError("Inspectors can only review their own inspections")

    review = HumanReview(
        inspection_id=inspection_id,
        ml_result_id=ml_result_id,
        reviewer_id=current_user.id,
        decision=decision,
        confirmed_class=confirmed_class,
        comments=comments,
    )
    db.session.add(review)
    db.session.flush()

    # Auto-create defect when decision confirms a defect
    defect = None
    if decision in {ReviewDecision.CONFIRM.value, ReviewDecision.CORRECT.value}:
        defect_class = confirmed_class if decision == ReviewDecision.CORRECT.value else (
            ml_result.predicted_class if ml_result_id and ml_result else defect_category
        )
        desc = defect_description
        item_number = data.get("item_number")
        if item_number is not None:
            prefix = f"Item #{item_number}"
            desc = f"{prefix}: {defect_description}" if defect_description else prefix
        defect = Defect(
            inspection_id=inspection_id,
            review_id=review.id,
            defect_category=defect_category or defect_class or "unclassified",
            description=desc,
            severity=defect_severity,
            status=DefectStatus.OPEN.value,
            created_by_id=current_user.id,
        )
        db.session.add(defect)
        db.session.flush()

    # Transition inspection status
    if decision == ReviewDecision.NEEDS_MORE_EVIDENCE.value:
        inspection.status = InspectionStatus.NEEDS_MORE_EVIDENCE.value
    else:
        inspection.status = InspectionStatus.REVIEWED.value

    log_audit_event(
        actor_id=current_user.id,
        action="review.create",
        entity_type="human_review",
        entity_id=review.id,
        details={
            "inspection_id": inspection_id,
            "decision": decision,
            "defect_id": defect.id if defect else None,
        },
    )
    db.session.commit()

    response = {"message": "Review submitted", "review": review.to_dict()}
    if defect:
        response["defect"] = defect.to_dict()
    return jsonify(response), 201
