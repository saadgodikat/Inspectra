"""Products API endpoints — CRUD, search, filter, archival."""

from flask import Blueprint, jsonify, request
from sqlalchemy import or_

from backend.extensions import db
from backend.models.product import Product
from backend.middleware.permissions import require_permission
from backend.middleware.errors import NotFoundError, ValidationError, ConflictError
from backend.services.audit_service import log_audit_event

products_bp = Blueprint("products", __name__, url_prefix="/api/products")


@products_bp.route("", methods=["GET"])
@require_permission("product.view")
def list_products(current_user):
    """List products with optional search and filters.

    Query params:
      - search: string (matches product_code or name)
      - category: string
      - status: 'active' | 'archived' | 'all' (default: 'all')
    """
    search = request.args.get("search", "").strip()
    category = request.args.get("category", "").strip()
    status = request.args.get("status", "all").strip().lower()

    query = Product.query

    if status == "active":
        query = query.filter_by(is_active=True)
    elif status == "archived":
        query = query.filter_by(is_active=False)

    if category:
        query = query.filter_by(category=category)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            or_(
                Product.product_code.ilike(search_pattern),
                Product.name.ilike(search_pattern),
                Product.description.ilike(search_pattern),
            )
        )

    products = query.order_by(Product.created_at.desc()).all()
    return jsonify({
        "products": [p.to_dict(include_counts=True) for p in products],
        "count": len(products),
    }), 200


@products_bp.route("/<int:product_id>", methods=["GET"])
@require_permission("product.view")
def get_product(product_id, current_user):
    """Get single product details, including linked batches."""
    product = db.session.get(Product, product_id)
    if not product:
        raise NotFoundError("Product not found")

    data = product.to_dict(include_counts=True)
    data["batches"] = [b.to_dict() for b in product.batches.order_by(db.desc("created_at")).all()]
    return jsonify({"product": data}), 200


@products_bp.route("", methods=["POST"])
@require_permission("product.create")
def create_product(current_user):
    """Create a new product (Quality Manager only).

    Body: { product_code, name, category?, description? }
    """
    data = request.get_json(silent=True)
    if not data:
        raise ValidationError("JSON body required")

    product_code = (data.get("product_code") or "").strip().upper()
    name = (data.get("name") or "").strip()
    category = (data.get("category") or "").strip() or None
    description = (data.get("description") or "").strip() or None

    errors: dict[str, str] = {}
    if not product_code:
        errors["product_code"] = "Product code is required"
    elif len(product_code) > 100:
        errors["product_code"] = "Product code must be <= 100 characters"

    if not name:
        errors["name"] = "Product name is required"
    elif len(name) > 255:
        errors["name"] = "Product name must be <= 255 characters"

    if errors:
        raise ValidationError("Validation failed", details=errors)

    # Check uniqueness of product_code
    existing = Product.query.filter_by(product_code=product_code).first()
    if existing:
        raise ConflictError(f"Product code '{product_code}' already exists")

    product = Product(
        product_code=product_code,
        name=name,
        category=category,
        description=description,
        is_active=True,
    )
    db.session.add(product)
    db.session.flush()

    # Log audit event
    log_audit_event(
        actor_id=current_user.id,
        action="product.create",
        entity_type="product",
        entity_id=product.id,
        details={
            "product_code": product.product_code,
            "name": product.name,
            "category": product.category,
        },
    )
    db.session.commit()

    return jsonify({
        "message": "Product created successfully",
        "product": product.to_dict(include_counts=True),
    }), 201


@products_bp.route("/<int:product_id>", methods=["PUT"])
@require_permission("product.edit")
def update_product(product_id, current_user):
    """Update product details (Quality Manager only).

    Body: { product_code?, name?, category?, description? }
    """
    product = db.session.get(Product, product_id)
    if not product:
        raise NotFoundError("Product not found")

    data = request.get_json(silent=True)
    if not data:
        raise ValidationError("JSON body required")

    changes = {}

    if "product_code" in data:
        new_code = (data["product_code"] or "").strip().upper()
        if not new_code:
            raise ValidationError("Product code cannot be empty")
        if new_code != product.product_code:
            existing = Product.query.filter_by(product_code=new_code).first()
            if existing and existing.id != product.id:
                raise ConflictError(f"Product code '{new_code}' already exists")
            changes["product_code"] = {"from": product.product_code, "to": new_code}
            product.product_code = new_code

    if "name" in data:
        new_name = (data["name"] or "").strip()
        if not new_name:
            raise ValidationError("Product name cannot be empty")
        changes["name"] = {"from": product.name, "to": new_name}
        product.name = new_name

    if "category" in data:
        new_category = (data["category"] or "").strip() or None
        changes["category"] = {"from": product.category, "to": new_category}
        product.category = new_category

    if "description" in data:
        new_desc = (data["description"] or "").strip() or None
        changes["description"] = {"from": product.description, "to": new_desc}
        product.description = new_desc

    if changes:
        log_audit_event(
            actor_id=current_user.id,
            action="product.update",
            entity_type="product",
            entity_id=product.id,
            details=changes,
        )
        db.session.commit()

    return jsonify({
        "message": "Product updated successfully",
        "product": product.to_dict(include_counts=True),
    }), 200


@products_bp.route("/<int:product_id>/archive", methods=["POST"])
@require_permission("product.archive")
def archive_product(product_id, current_user):
    """Archive a product (Quality Manager only).

    Archived products remain accessible in historical inspection records.
    Never physically deleted.
    """
    product = db.session.get(Product, product_id)
    if not product:
        raise NotFoundError("Product not found")

    if not product.is_active:
        return jsonify({
            "message": "Product is already archived",
            "product": product.to_dict(include_counts=True),
        }), 200

    product.is_active = False
    log_audit_event(
        actor_id=current_user.id,
        action="product.archive",
        entity_type="product",
        entity_id=product.id,
        details={"product_code": product.product_code},
    )
    db.session.commit()

    return jsonify({
        "message": "Product archived successfully",
        "product": product.to_dict(include_counts=True),
    }), 200


@products_bp.route("/<int:product_id>/unarchive", methods=["POST"])
@require_permission("product.archive")
def unarchive_product(product_id, current_user):
    """Restore an archived product (Quality Manager only)."""
    product = db.session.get(Product, product_id)
    if not product:
        raise NotFoundError("Product not found")

    if product.is_active:
        return jsonify({
            "message": "Product is already active",
            "product": product.to_dict(include_counts=True),
        }), 200

    product.is_active = True
    log_audit_event(
        actor_id=current_user.id,
        action="product.unarchive",
        entity_type="product",
        entity_id=product.id,
        details={"product_code": product.product_code},
    )
    db.session.commit()

    return jsonify({
        "message": "Product restored successfully",
        "product": product.to_dict(include_counts=True),
    }), 200
