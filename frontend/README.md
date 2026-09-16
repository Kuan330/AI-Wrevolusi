# AI-Wrevolusi Frontend

React + TypeScript + Vite frontend for AI-Wrevolusi.

See [ARCHITECTURE.md](ARCHITECTURE.md) for module ownership and dependency
rules.

Node.js 24 is required. Use `.nvmrc` or another version manager to select it.

## Run

```bash
cd frontend
npm ci
npm run dev
```

Fixed development URL:

- `http://127.0.0.1:5173`

Vite uses `strictPort: true`. If port 5173 is occupied, it stops with an
error instead of selecting another port. Reuse the existing development
server or stop it before running `npm run dev` again. Do not pass a different
`--port` argument.

## Build

```bash
npm run build
npm run preview
```

## Verify

Run the architecture boundary check, lint, tests, and production build:

```bash
npm run check
```

## API Base URL

Create `frontend/.env` from `.env.example`:

```bash
cp .env.example .env
```

Default value:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000/api/v1
```
