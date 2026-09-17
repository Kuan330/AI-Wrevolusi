# Figure sources

These figures describe code and configuration at commit `aa4f8fb` on `kuan/design-prototype`. They do not verify a running Vercel deployment, Neon database, installed schema, data coverage, credentials or external AI availability.

## Deliverables

- `../figures/System-Architecture.png`: browser, hosting and external service boundaries, 3200 × 2000 pixels.
- `../figures/ERD-Overview.png`: selected current core entities, 3200 × 2200 pixels.
- `../figures/ERD.PNG`: complete table and declared FK coverage across four panels, 6400 × 4400 pixels. Zoom to read or use the individual panels in print.
- `../figures/ERD-Identity-Learning.png`, `ERD-Work-Planning.png`, `ERD-Reference-Catalogue.png`, `ERD-Legacy.png`: individual 3200 × 2200 panels.
- Matching SVG and standalone HTML are editable offline sources. Arial/Helvetica system fonts are used, with no web font download.

## Coverage and notation

The complete sheet represents 26 distinct tables: 15 ORM tables, 3 SQL reference tables used by current code and 8 separately labelled historical SQL business tables. All 25 declared foreign key relationships appear in the detailed panels. Repeated `app_users`, `occupations` and `learning_progress` boxes are cross-panel anchors, not additional tables.

Entity boxes show selected key and domain fields. `schema-evidence.json` contains the full column/type/nullability inventory, uniqueness constraints, FK actions, logical associations, source lines and runtime evidence. The diagrams are not a substitute for the full schema inventory.

Solid lines represent FKs declared in source. End labels give the number of records at that end per record at the opposite end. Dotted lines represent logical code/slug/order associations and do not assert database constraints. PK means primary key, FK foreign key and UQ unique. A combined primary key is marked on each component.

`app_accounts.workspace` is one JSON column containing string-encoded payloads by key, not separate relational profile/course/plan tables. `learning_progress.course_id` stores a catalogue code, not the course UUID. Its skill slug and zero-based chapter index also have no catalogue FK. `task_assist_interactions.task_key` refers to browser profile task identity, not `tasks.id`. Hierarchy fields on reference occupations and catalogue chapters have no self FK.

The grey legacy panel documents SQL source only. No current backend consumer was found for those eight tables. It does not recommend deleting existing data. The dashed `task_capability_link` box is present in ORM metadata but no explicit current runtime write was found.

## Architecture evidence

- `vercel.json`: same-origin frontend/backend service rewrites and SPA fallback.
- `frontend/src/routes/index.tsx`, `frontend/src/features/`: page composition and shared domain modules.
- `frontend/src/services/accountStorage.ts`, `frontend/src/infrastructure/storage/localPreferences.ts`: account-owned workspace and local UI preferences.
- `frontend/vite.config.ts`, `dev`, `scripts/dev.py`: localhost API proxy and launcher.
- `backend/app/main.py`, `backend/main.py`: FastAPI application and deployment entrypoint.
- `backend/app/services/`, `backend/app/repositories/`: domain logic and persistence.
- `backend/app/core/config.py`, `backend/app/services/ai_gateway.py`, `backend/app/services/skill_directions.py`: configurable gateway and separate skill-direction clients. The configured gateway supports an enabled-by-default fallback relay. No offline-only behavior is implied.
- `data/reference/import_from_raw.py`, `db/seed_reference.py`: separate reference preparation/import workflow.

## Rebuilding without installing packages

Run `python3 build_figures.py` from any directory. It uses the checked-in evidence JSON and standard library only.

Then run `node render_figures.cjs` with an existing Playwright installation on `NODE_PATH` and existing Google Chrome. The renderer blocks HTTP/HTTPS requests and reads local files only. It validates that labels remain within each SVG frame, then captures the SVG at 2× scale. No dependency installation or database connection is performed.
