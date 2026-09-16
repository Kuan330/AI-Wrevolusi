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
    assert ('user_id', 'task_id') in unique_columns
    task_unique_columns = {
        tuple(column.name for column in constraint.columns)
        for constraint in Task.__table__.constraints
        if isinstance(constraint, UniqueConstraint)
    }
    assert ('user_id', 'profile_task_id') in task_unique_columns
    assert ('user_id', 'id') in task_unique_columns
    composite_task_ownership = {
        (
            tuple(element.parent.name for element in constraint.elements),
            tuple(element.target_fullname for element in constraint.elements),
        )
        for constraint in TaskAssistInteraction.__table__.foreign_key_constraints
    }
    assert (
        ('user_id', 'task_id'),
        ('tasks.user_id', 'tasks.id'),
    ) in composite_task_ownership
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
    assert "op.add_column(\n        'tasks'" in source
    assert "constraint_name='uq_tasks_user_profile_task'" in source
    assert "constraint_name='uq_tasks_user_id_id'" in source
    assert "['user_id', 'task_id'],\n            ['tasks.user_id', 'tasks.id']" in source
    assert "name='fk_task_assist_owned_task'" in source
    assert "name='uq_task_assist_user_task'" in source
    assert "name='ck_task_assist_completed_payload'" in source
    assert "name='ck_task_assist_pending_claim'" in source
    assert "sa.CheckConstraint(" in source
    assert "op.drop_table('task_assist_interactions')" in source

    records_source = (
        Path(__file__).parents[1] / 'app' / 'services' / 'task_assist_records.py'
    ).read_text(encoding='utf-8')
    assert 'claimed_at < stale_before' not in records_source
    assert 'question=question' in records_source
    assert "question='How can AI assist me in completing this task?'" not in records_source
