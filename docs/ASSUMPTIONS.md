# Assumptions and decisions

## Topology: choose one

**Option A — same registrable domain (recommended, full real-time).**
`admin.example.com`, `api.example.com`, `www.example.com`. Backend:
`FRONTEND_ORIGIN=https://www.example.com,https://admin.example.com`,
`COOKIE_DOMAIN=.example.com`, `COOKIE_SAMESITE=lax`, `TRUST_PROXY=1`.
Admin: `VITE_API_URL=https://api.example.com`. Cookies are first-party and the
Admin connects its WebSocket directly to the API.

**Option B — no custom domain (host proxy).**
The Admin host rewrites `/api/*` and `/socket.io/*` to the backend and
`VITE_API_URL` is empty; cookies are host-only and first-party. Vercel and
Netlify rewrite files are in `admin/vercel.json` and
`admin/public/_redirects`. **Static-host rewrites cannot proxy WebSockets**, so
the realtime layer starts on Socket.IO polling and the UI shows `Degraded`; chat
and inbox still work, with a few seconds of latency.

Providing neither option breaks admin login: the Admin deliberately has no
localStorage/bearer-token fallback. Admin tokens never touch JavaScript.

## Hosting

- The backend needs long-lived connections: Render, Railway, Fly, or a VPS —
  not serverless functions.
- **Single backend instance assumed.** Scaling beyond one instance requires the
  Socket.IO Redis adapter; it is not implemented.
- Backend dev default port is `8080`. The Admin Vite proxy and Client
  `.env.example` use `8000`, so set `PORT=8000` locally (or update both).
- Web dev proxies: Admin `vite.config.ts` proxies `/api` and `/socket.io`
  (`ws: true`); Client talks to `NEXT_PUBLIC_API_URL` directly (CORS allowlist).

## Environment

- Backend: no new variables. `TOTP_ENCRYPTION_KEY` is only required when 2FA is
  used. Email links reuse `FRONTEND_ORIGIN`: the first origin is the Client, an
  origin whose host contains `admin` is the Admin.
- Admin: `VITE_API_URL` (empty = same-origin proxy) and `VITE_CLIENT_URL`.
- Client: `NEXT_PUBLIC_API_URL` is the browser value. `API_URL` is kept as an
  optional server-only override (existing project convention); they normally
  point at the same API.

## Backend

The backend already implemented the full contract, so **no backend source
changes were needed**. `docs/BACKEND_AUDIT.md` records the audit. Typecheck,
lint and build pass.

## Data and rendering

- `GET /api/site` is the single public read. It is fetched server-side with ISR
  (`revalidate: 60`, tag `site`, 5 s timeout) and resolves to `null` on any
  failure. `resolveSite` merges per section: a null section falls back; an
  explicit empty list is respected. The landing page never breaks when the API
  is down.
- The public store is created per request/mount via `useState`, never a
  singleton. Sections read memoised selectors. A client `SiteRefresh` re-fetches
  on focus/reconnect at most once per minute and replaces state only when
  `generatedAt` is newer.
- The chat route has its own Redux store and RTK Query API so `socket.io-client`
  and chat code are absent from the landing bundle. The guest token lives in a
  module-level variable backed by `sessionStorage`; it never enters Redux.
- Messages are stored in an entity adapter; optimistic sends have `seq: 0` and
  sort after persisted messages until acknowledged.
- Contact form uses RTK Query and a hidden honeypot. It never emails the visitor.
- Invite join errors: the API intentionally returns identical `404` responses
  for invalid, expired and revoked tokens, so the Client shows one combined
  "isn't valid / may have expired" state. A closed conversation shows a
  read-only end state.

## Deviations

- No automated tests were written or run (per the brief). Verification was
  typecheck + lint + production build for all three projects.
- `docs/MANUAL_QA.md` is the owner's checklist for end-to-end behaviour.
