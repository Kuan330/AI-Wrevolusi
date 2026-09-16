# Frontend architecture

The frontend is one React application. npm manages its JavaScript dependencies;
`package-lock.json` is committed and local or CI setup uses `npm ci`.

## Module roles

```text
src/
├── routes/           route composition only
├── pages/            route-level UI and page-only components
├── features/         reusable business rules, types and feature UI
├── infrastructure/   browser storage and other external adapters
├── services/         backend API clients
├── components/       application-wide layout and generic UI
└── constants/        application-wide static configuration
```

Dependencies flow toward reusable modules:

```text
routes -> pages -> features -> infrastructure/services
                 -> components/constants
```

Rules:

- A page can import its own page components.
- A page must not import another page's internal files. Move the shared
  contract or behavior into `features/`.
- A feature must not import route pages.
- Only `infrastructure/storage` may access browser storage directly.
- Keep API transport in `services/`; feature modules may wrap it with a
  domain-specific repository when needed.
- Import concrete modules directly. Do not add broad barrel files that pull
  unrelated feature code into the same bundle.

`npm run check:boundaries` enforces the page, feature and storage rules.

## Current feature ownership

- `features/work-profile`: confirmed work profile, task types and persistence.
- `features/exposure`: ILO exposure rules, task scoring and shared evidence UI.
- `features/skills`: learning-skill selection and evidence mapping.
- `features/learning`: course catalogue, learning resources and library state.
- `features/planning`: calendar model, scheduling and plan repositories.

Route pages may still coordinate more than one feature. Cross-feature state
changes belong in an explicit feature operation, not inside a generic UI
component.

## State and persistence

`infrastructure/storage/keys.ts` is the only registry for application storage
keys. `accountStorage` owns guest-versus-account behavior and server
synchronization. `browserStorage` is the low-level browser adapter.

Do not call `localStorage` from pages or feature modules. Add a repository or a
small method to the storage infrastructure instead.

## Verification

```bash
npm run check
```

This runs architecture boundaries, lint, Node tests and the production build.
