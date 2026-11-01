# Admin

Private single-owner console (React 19 + Vite + Redux Toolkit/RTK Query +
Socket.IO + Tailwind 4). It has no server: **the API is the security boundary**
and every guard here is UX only.

## Setup

```bash
cd admin
npm install
cp .env.example .env
npm run dev        # http://localhost:5173
```

The dev server proxies `/api` and `/socket.io` (with WebSockets) to
`http://localhost:8000`, so `VITE_API_URL` stays empty locally. Start the backend
with `PORT=8000` (its default is 8080), then create the owner account:

```bash
cd backend && npm run admin:create
```

## Environment

- `VITE_API_URL` — backend origin (e.g. `https://api.example.com`), or **empty**
  to use the host proxy.
- `VITE_CLIENT_URL` — public site URL for "View site" and previews.

## Hosting topology

**Option B — same-origin proxy.** The Admin host proxies `/api` and
`/socket.io` to the backend (the `vercel.json` rewrites, the Vite dev proxy
locally) and `VITE_API_URL` is empty, so every request is same-origin:
the session cookie is first-party on the Admin domain, no CORS preflight is
involved, and `SameSite=None` is not needed for the Admin. WebSocket upgrades
are not proxied, so the realtime layer uses Socket.IO polling and the
ConnectionPill shows `Degraded`; chat and the inbox keep working with a few
seconds of latency. `connect-src` is `'self'` because `VITE_API_URL` is empty.
If you set `VITE_API_URL`, the generated CSP adds that origin and its `wss://`
form automatically, but the session cookie then depends on the topology below.

**Alternative — one registrable domain:** `admin.example.com` +
`api.example.com`, backend cookies `Domain=.example.com`, `Secure`, `httpOnly`,
`SameSite=Lax`, `VITE_API_URL=https://api.example.com`. WebSockets then work end
to end on a long-running host; the generated CSP already allows that origin.

**Do not call the API directly from two `*.vercel.app` projects.** `vercel.app`
is a public suffix, so the two deployments are different sites: the session
cookies become third-party and browsers that block those (Safari, Firefox,
Chrome with third-party cookies off) drop them. Login then appears to succeed
while `/auth/me` immediately returns 401.

Do **not** expect a localStorage/bearer fallback: there isn't one. Without one of
these topologies, login cannot work in those browsers.

The backend must allow both origins (`FRONTEND_ORIGIN_CLIENT` and
`FRONTEND_ORIGIN_ADMIN`, each a comma-separated allowlist) and run on a host
with long-lived connections (Render, Railway, Fly, VPS). Single instance
assumed; horizontal scaling needs the Socket.IO Redis adapter.

## Security files

- `public/robots.txt` disallows everything; `index.html` has `noindex,nofollow`.
- `vercel.json` sets `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, a
  restrictive `Permissions-Policy` and HSTS. Vercel applies only `vercel.json`;
  `public/_headers` and `public/_redirects` are Netlify-format copies that
  Vercel ignores.
- **The CSP is generated, not hardcoded.** `vite.config.ts` injects a
  `<meta http-equiv="Content-Security-Policy">` into `index.html` at build time,
  deriving `connect-src` from `VITE_API_URL` (the same value the API client
  uses) plus its `ws:`/`wss:` form. Vercel cannot interpolate env vars into
  `vercel.json` headers, and a hardcoded `connect-src` is what once blocked the
  deployed API from the admin. An empty `VITE_API_URL` yields `connect-src
  'self'`. `frame-ancestors` is intentionally absent from the meta policy
  (browsers ignore it there); `X-Frame-Options: DENY` covers framing.
- No third-party scripts, analytics or CDNs.

## Verification

```bash
npm run lint
npm run build
npm test
```

`npm test` covers the sanitising error-message helper. Use `docs/MANUAL_QA.md` in
the repository root for the end-to-end checklist.
