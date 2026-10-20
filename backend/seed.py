"""Seed / demo CLI commands for users, products, and batches."""

from datetime import date
import click
from backend.extensions import db
from backend.models.user import User, UserRole
from backend.models.product import Product
from backend.models.batch import Batch, BatchStatus


def register_seed_commands(app):
    """Register Flask CLI commands for seeding data."""

    @app.cli.command("seed-users")
    def seed_users():
        """Create demo users for each role (inspector, supervisor, quality_manager)."""
        demo_users = [
            {
                "name": "Alice Inspector",
                "email": "alice@example.com",
                "password": "inspector123",
                "role": UserRole.INSPECTOR.value,
            },
            {
                "name": "Bob Supervisor",
                "email": "bob@example.com",
                "password": "supervisor123",
                "role": UserRole.SUPERVISOR.value,
            },
            {
                "name": "Carol QualityMgr",
                "email": "carol@example.com",
                "password": "qualitymgr123",
                "role": UserRole.QUALITY_MANAGER.value,
            },
        ]

        created = 0
        for u in demo_users:
            existing = User.query.filter_by(email=u["email"]).first()
            if existing:
                click.echo(f"  ⏭  {u['email']} already exists — skipping")
                continue
            user = User(name=u["name"], email=u["email"], role=u["role"])
            user.set_password(u["password"])
            db.session.add(user)
            created += 1
            click.echo(f"  ✅ Created {u['email']} ({u['role']})")

        db.session.commit()
        click.echo(f"Done — {created} user(s) created.")

    @app.cli.command("seed-products")
    def seed_products():
        """Create sample manufacturing products."""
        demo_products = [
            {
                "product_code": "PRD-MET-001",
                "name": "Precision Flange Assembly",
                "category": "Machined Castings",
                "description": "High-tolerance aircraft-grade steel flange with fine-surface sealing bead.",
            },
            {
                "product_code": "PRD-MET-002",
                "name": "Automotive Chassis Bracket",
                "category": "Metal Stamping",
                "description": "Galvanized cold-rolled steel bracket for suspension mountings.",
            },
            {
                "product_code": "PRD-MET-003",
                "name": "Helical Transmission Gear",
                "category": "Powertrain",
                "description": "Case-hardened helical gear for industrial robotics drive train.",
            },
        ]

        created = 0
        for p in demo_products:
            existing = Product.query.filter_by(product_code=p["product_code"]).first()
            if existing:
                click.echo(f"  ⏭  Product {p['product_code']} already exists — skipping")
                continue
            prod = Product(
                product_code=p["product_code"],
                name=p["name"],
                category=p["category"],
                description=p["description"],
                is_active=True,
            )
            db.session.add(prod)
            created += 1
            click.echo(f"  ✅ Created Product {p['product_code']} ({p['name']})")

        db.session.commit()
        click.echo(f"Done — {created} product(s) created.")

    @app.cli.command("seed-batches")
    def seed_batches():
        """Create sample production batches."""
        flange = Product.query.filter_by(product_code="PRD-MET-001").first()
        bracket = Product.query.filter_by(product_code="PRD-MET-002").first()
        gear = Product.query.filter_by(product_code="PRD-MET-003").first()

        if not flange or not bracket:
            click.echo("  ⚠️ Please run 'flask seed-products' first!")
            return

        demo_batches = [
            {
                "batch_number": "BAT-2026-F01",
                "product_id": flange.id,
                "production_date": date(2026, 10, 15),
                "quantity": 1200,
                "status": BatchStatus.UNDER_INSPECTION.value,
                "production_line": "CNC Line 4",
                "supplier": "Apex Castings Corp",
            },
            {
                "batch_number": "BAT-2026-B01",
                "product_id": bracket.id,
                "production_date": date(2026, 10, 18),
                "quantity": 3500,
                "status": BatchStatus.PRODUCED.value,
                "production_line": "Stamping Press B",
                "supplier": "Vanguard Precision Metal",
            },
            {
                "batch_number": "BAT-2026-G01",
                "product_id": gear.id if gear else flange.id,
                "production_date": date(2026, 10, 20),
                "quantity": 450,
                "status": BatchStatus.IN_PRODUCTION.value,
                "production_line": "Robotics Cell 1",
                "supplier": "Kinetics Engineering",
            },
        ]

        created = 0
        for b in demo_batches:
            existing = Batch.query.filter_by(batch_number=b["batch_number"]).first()
            if existing:
                click.echo(f"  ⏭  Batch {b['batch_number']} already exists — skipping")
                continue
            batch = Batch(**b)
            db.session.add(batch)
            created += 1
            click.echo(f"  ✅ Created Batch {b['batch_number']} [{b['status']}]")

        db.session.commit()
        click.echo(f"Done — {created} batch(es) created.")

    @app.cli.command("seed-inspections")
    def seed_inspections():
        """Create sample inspections."""
        from backend.models.inspection import Inspection, InspectionStatus

        alice = User.query.filter_by(email="alice@example.com").first()
        flange = Product.query.filter_by(product_code="PRD-MET-001").first()
        batch_flange = Batch.query.filter_by(batch_number="BAT-2026-F01").first()

        if not alice or not flange or not batch_flange:
            click.echo("  ⚠️ Please seed users, products, and batches first!")
            return

        demo_inspections = [
            {
                "product_id": flange.id,
                "batch_id": batch_flange.id,
                "inspector_id": alice.id,
                "sample_reference": "SN-FL-9021",
                "sample_type": "surface",
                "observations": "Inspected sealing lip under 10x magnification. No visible tool marks or porosity.",
                "status": InspectionStatus.PENDING_UPLOAD.value,
            },
        ]

        created = 0
        for data in demo_inspections:
            existing = Inspection.query.filter_by(
                product_id=data["product_id"],
                batch_id=data["batch_id"],
                sample_reference=data["sample_reference"],
            ).first()
            if existing:
                click.echo(f"  ⏭  Inspection {data['sample_reference']} already exists — skipping")
                continue
            insp = Inspection(**data)
            db.session.add(insp)
            created += 1
            click.echo(f"  ✅ Created Inspection {data['sample_reference']}")

        db.session.commit()
        click.echo(f"Done — {created} inspection(s) created.")

    @app.cli.command("seed-all")
    def seed_all():
        """Run all seed commands (users, products, batches, inspections)."""
        ctx = click.get_current_context()
        ctx.invoke(seed_users)
        ctx.invoke(seed_products)
        ctx.invoke(seed_batches)
        ctx.invoke(seed_inspections)
