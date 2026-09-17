# Database baseline proposal

Status: proposal only. No migration, database inspection, stamp, seed, or schema
change is part of this work.

## Current ownership

- SQLAlchemy models describe current application tables, including `app_users`
  and `app_accounts`.
- Alembic starts at `0001_learning_tables`, then `0002_catalogue_tables`, then
  `0003_task_assist_once`. The first revision references `app_users` but does not
  create it. These revision identities must remain stable for installed systems.
- `AUTO_CREATE_TABLES` calls metadata `create_all`. It creates missing tables,
  does not upgrade existing columns, and does not record migration history.
- `db/schema.sql` creates reference tables and older business tables such as
  `users` and `work_profiles`; it is not the current application baseline.

## Evidence required before choosing a baseline

An authorized owner must inventory each environment's Alembic revision, actual
application/reference tables, columns, constraints, indexes, enum values, and
seed versions. Compare these with the committed models and all three revisions.
Record whether tables came from startup creation, migrations, or older scripts.
Do not assume an empty revision table means an empty database.

Confirm which legacy business tables have callers or retained data. Keep their
retention/removal decisions separate from making current setup reproducible.

## Proposed bounded implementation

1. Build a schema inventory from a disposable database and an approved schema-only
   snapshot of an existing environment. Do not copy production account data.
2. Choose an explicit baseline/adoption design from that evidence. It must create
   pre-learning application tables before the existing chain on fresh installs,
   preserve existing revision identities, and verify installed schema before any
   adoption marker is considered. Do not blindly stamp a database or rewrite
   historical revisions that may already be deployed.
3. Make one documented command sequence own application schema creation. Document
   reference schema/seed ownership and order separately. Keep startup table
   creation out of migration-managed environments.
4. Document recovery and rollback limits before approving deployment. A baseline
   must not drop data merely to make metadata comparisons pass.

## Required verification before adoption

- Empty disposable PostgreSQL database to head, then a second no-op upgrade.
- Representative existing schema snapshots at each supported starting revision
  to head, with preserved data and constraints.
- Metadata comparison with an explicit allowlist for independently owned
  reference and legacy tables; no unintended drops from autogeneration.
- Account, task, catalogue, learning progress, and reference-data smoke checks.
- Real PostgreSQL tests for concurrent chapter progress and first check-ins,
  workspace revision conflicts, and task rollback. Offline SQL compilation and
  mocked sessions do not establish concurrency behavior.

This proposal deliberately supplies no production upgrade or stamping command:
the installed history is still unknown, and those actions require a separate
reviewed plan and authorization.
