# AI-Wrevolusi Starter Repository

AI-Wrevolusi helps working women in Malaysia understand how AI may change their work, recognise their existing capabilities, and prepare through realistic actions that fit around work and care responsibilities.

This first starter repository focuses on the pilot user **Christine** (Sales Supervisor in Selangor) and supports her validated MASCO occupation plus up to two related occupations.

## What is included in this pull request

- Next.js (current stable) + TypeScript starter app
- Accessible application shell with navigation for Epics E1-E8
- Placeholder pages for all eight Epics
- Domain TypeScript types for occupations, tasks, task context, task-change results, capabilities, pathways, priorities, actions, and user corrections
- Pilot fixtures for three occupations with clear TODO markers where validated data is still missing
- AI provider interfaces only (no real AI calls and no API keys required)
- Documentation for scope, dependencies, and data readiness
- Formatting, linting, type checking, unit tests, and CI workflow

## What is not implemented yet

- No full Epic business logic yet
- No real NLP or ranking model calls
- No authentication, payments, or deployment infrastructure
- No claim of support for all MASCO occupations

## Getting started

### Prerequisites

- Node.js 22+
- npm 10+

### Install dependencies

```bash
npm install
```

### Run development server

```bash
npm run dev
```

Open <http://localhost:3000>.

### Check formatting

```bash
npm run format:check
```

### Lint

```bash
npm run lint
```

### Type check

```bash
npm run typecheck
```

### Run tests

```bash
npm run test
```

### Build for production

```bash
npm run build
```

## Documentation

- Product scope: `docs/product-scope.md`
- Epics and dependencies: `docs/epics-and-dependencies.md`
- Data readiness: `docs/data-readiness.md`
