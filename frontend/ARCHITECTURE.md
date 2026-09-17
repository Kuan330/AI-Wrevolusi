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
| `features/learning-planning/` | Course contracts/catalogue access, saved library, plan-course state, calendar contracts and course operations |
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

Existing storage keys and record versions stay compatible. New optional fields
must have safe defaults for older records. Never overwrite unreadable saved data
with an empty record.

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

Use Node 24 (`.nvmrc`) and npm. `package-lock.json` is committed; setup uses
`npm ci`. With dependencies already installed:

```bash
cd frontend
npm run check
```

This runs architecture boundaries, lint, Node tests and the production build.
Tests resolve source files relative to their own module rather than the shell's
working directory. Run browser checks against an isolated or mocked API for
profile changes, review notices, course add/remove, reload and account gates.
A frontend build does not verify deployed API routing or database persistence.
