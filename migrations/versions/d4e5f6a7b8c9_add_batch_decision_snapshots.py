"""add batch decision evidence snapshots

Revision ID: d4e5f6a7b8c9
Revises: c1f3a2b4d5e6
Create Date: 2026-10-23 17:30:00.000000
"""
from alembic import op
import sqlalchemy as sa


revision = "d4e5f6a7b8c9"
down_revision = "c1f3a2b4d5e6"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("batch_decisions", schema=None) as batch_op:
        batch_op.add_column(sa.Column("total_open_actions", sa.Integer(), nullable=True))
        batch_op.add_column(
            sa.Column(
                "advisories_acknowledged",
                sa.Boolean(),
                nullable=False,
                server_default=sa.false(),
            )
        )
        batch_op.add_column(sa.Column("evidence_snapshot", sa.JSON(), nullable=True))


def downgrade():
    with op.batch_alter_table("batch_decisions", schema=None) as batch_op:
        batch_op.drop_column("evidence_snapshot")
        batch_op.drop_column("advisories_acknowledged")
        batch_op.drop_column("total_open_actions")
