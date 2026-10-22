"""add inspection_items table

Revision ID: c1f3a2b4d5e6
Revises: adbdaf69ad86
Create Date: 2025-01-01 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = 'c1f3a2b4d5e6'
down_revision = 'adbdaf69ad86'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'inspection_items',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('inspection_id', sa.Integer(), nullable=False),
        sa.Column('item_number', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(50), nullable=False),
        sa.Column('image_id', sa.Integer(), nullable=True),
        sa.Column('ml_result_id', sa.Integer(), nullable=True),
        sa.Column('override_decision', sa.String(50), nullable=True),
        sa.Column('override_comment', sa.Text(), nullable=True),
        sa.Column('override_by_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['inspection_id'], ['inspections.id']),
        sa.ForeignKeyConstraint(['image_id'], ['inspection_images.id']),
        sa.ForeignKeyConstraint(['ml_result_id'], ['ml_results.id']),
        sa.ForeignKeyConstraint(['override_by_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('inspection_id', 'item_number', name='uq_inspection_item_number'),
    )
    op.create_index('ix_inspection_items_inspection_id', 'inspection_items', ['inspection_id'])


def downgrade():
    op.drop_index('ix_inspection_items_inspection_id', table_name='inspection_items')
    op.drop_table('inspection_items')
