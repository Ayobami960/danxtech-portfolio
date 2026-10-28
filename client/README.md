# Portfolio client

Public portfolio (Next.js 16 App Router). Every section is rendered from the
Admin-managed database through `GET /api/site`; the design is unchanged.

## Setup

```bash
cd client
pnpm install
cp .env.example .env.local
pnpm dev          # http://localhost:3000
```

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000
API_URL=http://localhost:8000          # optional server-side override
REVALIDATE_SECRET=change-me              # must match the backend
```

The backend's `FRONTEND_ORIGIN` must include the Client origin (CORS and chat
invite links).

## Data flow

- `app/page.tsx` (server) fetches `/api/site` with ISR: `revalidate: 60`, tag
  `site`, 5 s timeout. Failure returns `null`.
- `lib/site-data.ts` resolves each section: null → static fallback; an explicitly
  empty list is respected.
- `lib/store` holds a per-request Redux store (`siteSlice` + `publicApi` RTK
  Query). Sections read memoised selectors; a client component re-fetches on
  focus/reconnect at most once a minute.
- Admin mutations also call the Client's `/api/revalidate` webhook for instant
  updates by tag.

## Features

- Contact form: hidden honeypot, API validation mirrored client-side, field
  errors, duplicate/rate-limit/network messages. It creates a conversation in the
  Admin inbox and never emails the visitor on its own.
- Resume button: hidden when `resume.available` is false.
- `/chat` (invite-only): isolated layout, per-request store, `#t=` token
  exchanged then removed, guest token in `sessionStorage` only, Socket.IO with
  REST + polling fallback, typing/presence/read receipts. `noindex`, no guest
  data beyond one conversation.

## Build and deploy

```bash
pnpm lint
pnpm build
pnpm start
```

Deploy anywhere that runs Next.js (Vercel recommended). Keep the API on a host
with WebSocket support; see `docs/ASSUMPTIONS.md`.
