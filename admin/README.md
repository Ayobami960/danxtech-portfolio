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

**Recommended:** Admin and API on one registrable domain
(`admin.example.com` + `api.example.com`), backend cookies
`Domain=.example.com`, `Secure`, `httpOnly`, `SameSite=Lax`, and
`VITE_API_URL=https://api.example.com`. WebSockets work end to end.

**No custom domain:** deploy the SPA behind rewrites and leave `VITE_API_URL`
empty. `vercel.json` and `public/_redirects` proxy `/api` and `/socket.io`; copy
them and replace `api.example.com`. Static hosts cannot proxy WebSockets, so the
realtime layer uses Socket.IO polling and the ConnectionPill shows `Degraded`.
Chat and the inbox keep working with a few seconds of latency.

Do **not** expect a localStorage/bearer fallback: there isn't one. Without one of
these two topologies, login cannot work.

The backend must allow both origins (`FRONTEND_ORIGIN`) and run on a host with
long-lived connections (Render, Railway, Fly, VPS). Single instance assumed;
horizontal scaling needs the Socket.IO Redis adapter.

## Security files

- `public/robots.txt` disallows everything; `index.html` has `noindex,nofollow`.
- `vercel.json`, `public/_headers` set `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy: no-referrer`, a restrictive `Permissions-Policy`, HSTS and a
  CSP. Replace `api.example.com` in both CSP and rewrites. When using a
  same-origin proxy, you can drop the extra `connect-src` origins.
- No third-party scripts, analytics or CDNs.

## Verification

```bash
npm run lint
npm run build
```

There is no test suite. Use `docs/MANUAL_QA.md` in the repository root for the
end-to-end checklist.
