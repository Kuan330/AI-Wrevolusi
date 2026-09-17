from pathlib import Path

from sqlalchemy import UniqueConstraint

from app.models.task import Task
from app.models.task_assist import TaskAssistInteraction


def test_task_assist_model_and_migration_enforce_one_exchange_per_user_task() -> None:
    unique_columns = {
        tuple(column.name for column in constraint.columns)
        for constraint in TaskAssistInteraction.__table__.constraints
        if isinstance(constraint, UniqueConstraint)
    }
    check_names = {
        constraint.name
        for constraint in TaskAssistInteraction.__table__.constraints
        if constraint.__class__.__name__ == 'CheckConstraint'
    }
    check_sql = {
        constraint.name: str(constraint.sqltext)
        for constraint in TaskAssistInteraction.__table__.constraints
        if constraint.__class__.__name__ == 'CheckConstraint'
    }
    assert ('user_id', 'task_key') in unique_columns
    assert not hasattr(Task, 'profile_task_id')
    assert not any(
        tuple(column.name for column in constraint.columns) == ('user_id', 'profile_task_id')
        for constraint in Task.__table__.constraints
        if isinstance(constraint, UniqueConstraint)
    )
    assert {
        'ck_task_assist_status',
        'ck_task_assist_completed_payload',
        'ck_task_assist_pending_claim',
    } <= check_names
    assert 'question IS NOT NULL' in check_sql['ck_task_assist_pending_claim']

    migration = (
        Path(__file__).parents[1]
        / 'alembic'
        / 'versions'
        / '0003_add_task_assist_interactions.py'
    )
    source = migration.read_text(encoding='utf-8')
    assert "down_revision: Union[str, None] = '0002_catalogue_tables'" in source
    assert "op.create_table(\n        'task_assist_interactions'" in source
    assert "op.add_column('tasks'" not in source
    assert "op.create_unique_constraint" not in source
    assert "sa.Column('task_key', sa.String(length=128), nullable=False)" in source
    assert "sa.UniqueConstraint('user_id', 'task_key', name='uq_task_assist_user_task')" in source
    assert "['app_users.id']" in source
    assert "op.drop_table('task_assist_interactions')" in source
    assert "op.drop_table('task_assist_interactions')" in source

    records_source = (
        Path(__file__).parents[1] / 'app' / 'services' / 'task_assist_records.py'
    ).read_text(encoding='utf-8')
    assert 'claimed_at < stale_before' not in records_source
    assert 'question=question' in records_source
    assert "question='How can AI assist me in completing this task?'" not in records_source
