# Frontend architecture

The frontend is one React application with page-based UI and a few shared domain
modules. Keep route components and page-only UI in place. Extract shared state
and operations when more than one page owns the same behavior; do not move an
entire page just to satisfy a folder convention.

## Ownership

| Location | Responsibility |
|---|---|
| `routes/` | Routes, redirects, account gates and layout composition |
| `pages/` | Page UI, page hooks and page-only calculations |
| `features/work-profile/` | Confirmed profile, task contracts, profile persistence and learning-review status |
| `features/learning-planning/` | Course contracts/catalogue access, saved library, plan-course state, calendar contracts, course operations and progress synchronization |
| `services/` | API clients, account workspace synchronization and plan repository |
| `infrastructure/storage/localPreferences.ts` | Optional device UI preferences |
| `components/` | Shared UI, account controls and layouts |
| `constants/` | Shared presentation constants, including exposure palette/rules |

Pages compose shared domains. Shared domains and services must not import page
internals. Plan and Learning Centre use the same course operations and contracts;
neither imports the other's TypeScript modules. A shared stylesheet is fine.
Keep concrete module imports rather than broad barrels.

Some evidence UI remains under `pages/Analysis` and `pages/Skills`, although those
folders no longer represent standalone routes. Existing composition with
AIExposure is allowed. Moving all that UI is not required for this architecture.
Generic `components/ui` must not depend on those page folders.

## State and persistence

`services/accountStorage.ts` owns guest/account workspace storage, the list of
synchronized keys, the per-account cache, revisions and synchronization errors.
Shared course operations update the library and plan-course records together.
Progress and check-in operations live in the same domain, rather than in page
callbacks. Progress changes are first saved as pending entries in the existing
plan record, then acknowledged by the authenticated progress API. Failed entries
stay available for explicit retry. Server reads can raise local chapter values
without overwriting a newer draft. Older local progress without a pending entry
is preserved rather than assigned an invented study date.
Do not add independent browser mirrors or silently adopt guest records into a
signed-in account. Guest import remains an explicit account action.

Profile changes preserve saved courses, progress and calendar entries. Structural
changes mark learning recommendations and plans as needing review; practice-only
updates do not. The optional review flag lives in the existing profile record.
Users acknowledge review explicitly. Acknowledgement does not regenerate or
replace their plan. Refreshing stored skill context also preserves saved work. Explicit course or
skill removal still follows its confirmation dialog.

Device preferences (pet position, greeting history and tour memory) use
`localPreferences`; they are not account business data. The adapter tolerates
blocked browser storage. Existing demo records remain owned by `authService` and
`planService`. `AccountProvider` may access browser storage for the explicit guest
import. These narrow exceptions are listed in the checker; they do not permit
other components to store account data directly.

Course removal cancels pending writes for that course. The confirmation warns
about unsynced progress. Every awaited progress or check-in operation checks the
originating account and reads current state before applying results. The
catalogue directory uses one shared snapshot with a one-minute lifetime and an
explicit refresh action.

Existing storage keys and record versions stay compatible. New optional fields
must have safe defaults for older records. Never overwrite unreadable saved data
with an empty record.

Possibilities reads confirmed workspace evidence through the backend. An existing
modern profile is authoritative even when confirmation has been cleared. The
backend returns a recovery error for malformed saved profiles, and the page
shows that message with a link to review the profile. Legacy task data is only a
fallback when there is no modern profile.

## Boundary checks

`npm run check:boundaries` parses TypeScript and resolves local imports using the
application's TypeScript configuration. It checks aliases, relative imports,
reexports, type imports and literal dynamic imports. It enforces:

- Shared features, services, infrastructure and generic UI cannot import pages.
- Plan and Learning Centre cannot import each other's TypeScript internals.
- Infrastructure cannot depend on application features, services or UI.
- Direct browser storage access is restricted to the explicit owners above.
- Unresolved local code imports fail the check.

It does not prohibit every cross-page UI composition, infer business side effects,
or resolve dynamically constructed module/storage names. Behavioral tests cover
persistence and account transitions; the checker is not a replacement for them.

## Verification

Development and CI select Node 24.19.0 (`.nvmrc`) and npm 12.0.2. The manifest
allows compatible stable Node 24 patches from 24.19.0 onward, while rejecting
Node 25 and newer. `devEngines` enforces the runtime and npm version. Both
TypeScript configurations enable strict mode. `package-lock.json` is committed.
Setup uses `npm ci`. With dependencies already installed:

```bash
cd frontend
npm run check
```

This runs architecture boundaries, lint, Node tests and the production build.
Tests resolve source files relative to their own module rather than the shell's
working directory. Run browser checks against an isolated or mocked API for
profile changes, review notices, course add/remove, reload and account gates.
A frontend build does not verify deployed API routing or database persistence.

The GitHub Checks workflow runs the frontend check, offline backend and data
checks, and mocked launcher tests. It does not deploy or contact an existing
database. Vercel frontend install and build commands select the same npm version
explicitly while allowing its Node 24 patch updates.
