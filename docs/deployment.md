# Deployment

This guide covers Preview and Production deployment for the current Vercel
Services architecture.

## Architecture

The root `vercel.json` defines two services:

- `frontend/` builds the Vite application and serves `/`.
- `backend/` exposes the FastAPI `main:app` entrypoint behind `/api`.
- Neon remains external and is selected through `DATABASE_URL`.

The frontend calls `/api/v1` on the same deployment origin. Vercel routes that
path to the backend service.

UV owns Python dependency resolution through `backend/pyproject.toml` and
`backend/uv.lock`. The checked-in requirements files are generated
compatibility exports and must not be edited directly.

## Environment separation

Preview and Production must use separate Neon branches and separate secrets.
Never copy a production database URI into Preview.

Configure these variables in Vercel:

| Variable | Preview | Production |
|---|---|---|
| `DATABASE_URL` | Preview Neon branch URI | Production Neon branch URI |
| `JWT_SECRET_KEY` | Preview-only random secret | Production-only random secret |
| `DEBUG` | `false` | `false` |
| `AUTO_CREATE_TABLES` | `false` | `false` |
| `COOKIE_SECURE` | `true` | `true` |
| `COOKIE_SAMESITE` | `lax` | `lax` |
| `CORS_ORIGINS` | Preview alias when cross-origin access is required | Production domain when cross-origin access is required |
| `VITE_API_BASE_URL` | `/api/v1` | `/api/v1` |

The `AI_*` and `SKILL_LLM_*` variables are optional. Keep their real keys in
Vercel environment settings, not in Git. See
[`iteration2_integration_and_deployment.md`](iteration2_integration_and_deployment.md)
for the provider-specific behavior.

## Pre-deployment checks

Start from a clean, reviewed commit. Run:

```bash
uv lock --project backend --check
uv sync --project backend --locked --all-groups
uv sync --project backend --locked --all-groups --check
uv run --project backend --locked --all-groups \
  pytest -q backend/tests data/raw/test_masco_pdf.py

cd frontend
npm run lint
npm run build
node --test tests/*.test.mjs
```

Also confirm:

- `git diff --check` passes.
- No `.env` file or secret is staged.
- `backend/requirements.txt` contains runtime dependencies only.
- The intended Vercel project and Git branch are selected.
- Any database migration or reference seed has already been tested against the
  Preview database branch.

## Deploy Preview

1. Push the reviewed feature branch or open its pull request according to the
   repository workflow.
2. Wait for the Vercel Preview deployment to finish.
3. Read the build logs and confirm the backend uses Python 3.12 and resolves
   the committed dependency files without changing them.
4. Record the immutable Preview URL and deployment identifier.

Do not promote based only on a successful build record. Verify the running
deployment.

## Verify Preview

Set the actual Preview URL in the current shell:

```bash
export AIW_PREVIEW_URL=https://your-preview-url.example
```

Run the public checks:

```bash
curl -fsS "$AIW_PREVIEW_URL/" >/dev/null
curl -fsS "$AIW_PREVIEW_URL/api/healthz"
curl -fsS "$AIW_PREVIEW_URL/api/v1/reference/occupations" >/dev/null
```

Then use a Preview-only test account in the browser to verify:

1. Direct navigation to a nested frontend route loads the application.
2. Registration, login, refresh, and logout use secure cookies correctly.
3. Occupations and tasks come from the Preview database.
4. A workspace change persists after reload.
5. AI endpoints return their documented safe fallback when no provider is
   configured.
6. Browser requests stay on the deployment origin and do not call localhost or
   a different environment.

Check Vercel runtime logs for startup, dependency, database, CORS, and provider
errors. A green deployment without these runtime checks is not verified.

## Promote to Production

Promote only after the Preview evidence passes and the intended commit is
approved.

1. Reconfirm the Production environment variables and Neon branch.
2. Merge or push through the repository's approved protected-main workflow.
3. Wait for the Production deployment to finish.
4. Repeat the homepage, health, reference-data, authentication, persistence,
   and direct-route checks against the Production URL.
5. Record the deployed commit and Vercel deployment identifier.

A code deployment does not migrate or seed Neon. Run database changes as a
separate reviewed operation. Follow
[`iteration1_data_management.md`](iteration1_data_management.md), test against
the development or Preview branch first, and never use a development reset
operation against Production.

## Rollback

If the deployment fails after release:

1. Preserve the failing deployment URL, commit, and relevant logs.
2. Redeploy or promote the last verified Vercel deployment.
3. Repeat the production smoke checks.
4. Investigate the failed commit separately.

Rolling back code does not roll back database changes. Do not reverse a schema
or seed operation until its data impact and compatibility with the restored
code are understood.

## Dependency updates

After changing `backend/pyproject.toml`, regenerate and verify the lock and
compatibility exports:

```bash
uv lock --project backend
uv export --project backend --locked --no-dev --no-emit-project --no-hashes \
  --output-file backend/requirements.txt
uv export --project backend --locked --only-group database --no-hashes \
  --output-file db/requirements.txt
uv export --project backend --locked --only-group data --no-hashes \
  --output-file data/raw/requirements.txt
```

Deploy dependency changes to Preview before Production.
