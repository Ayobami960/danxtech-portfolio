# Portfolio API

Node 20+ · Express 5 · TypeScript · Drizzle ORM · PostgreSQL. Serves the public
portfolio, the private Admin API, auth/2FA and the live-chat module
(REST + Socket.IO).

## Setup

```bash
cd backend
npm install
cp .env.example .env      # fill DATABASE_URL and secrets
npm run db:migrate        # or `npm run db:push` against a local dev DB only
npm run db:seed           # idempotent portfolio seed (never creates an admin)
npm run admin:create      # owner account, prompted
npm run dev               # http://localhost:8080
```

The Admin Vite proxy and Client `.env.example` assume port **8000**; set
`PORT=8000` locally or update those URLs.

## Environment

Required in production: `DATABASE_URL`, `FRONTEND_ORIGIN_CLIENT` and
`FRONTEND_ORIGIN_ADMIN` (CSV allowlists; the first Client origin is used for
chat links), `JWT_ACCESS_SECRET`,
`JWT_REFRESH_SECRET`, `CSRF_SECRET`, `IP_HASH_SALT`. Cookie domain/samesite and
`TRUST_PROXY` control first-party cookies and real-IP rate limiting. SMTP
(`SMTP_*`, `MAIL_FROM`, `OWNER_EMAIL`) enables email notifications.
`TOTP_ENCRYPTION_KEY` (32 bytes, base64 or 64 hex) is required only when 2FA is
used.

ImageKit is the only media storage provider, in development and production.
`IMAGEKIT_PUBLIC_KEY`, `IMAGEKIT_PRIVATE_KEY` and `IMAGEKIT_URL_ENDPOINT` are
required and the server refuses to boot without them (`IMAGEKIT_END_POINT` is
still accepted as a legacy alias). Uploaded files are held in memory, never on
disk, and each row stores the delivery `url`, the ImageKit `fileId` and the
storage key; deletes use the `fileId`. Seeded assets under `external/` are never
touched.

Portfolio documents can also be uploaded as base64 JSON —
`POST /api/v1/admin/documents` with `{ fileName?, dataUrl }` (PDF, 3 MB decoded,
~4 MB request) — through the same driver, so validation and error handling are
identical. A project carries at most one PDF (a case study): attach the
returned metadata with `PATCH /api/v1/admin/projects/:id` as
`document: { url, fileId, key, name, sizeBytes }`, or send `document: null` to
remove it (the file is deleted from ImageKit). An upload that was never attached
is removed with `DELETE /api/v1/admin/documents/:fileId?key=<storageKey>`;
attached documents are refused with 409 so a project can never point at a
deleted file. Those columns come from `drizzle/0003_*.sql`, so run
`npm run db:migrate` before deploying. Multipart image and resume uploads are
unchanged.

## Deploy

Host on Render, Railway, Fly or a VPS for the full feature set, because
Socket.IO needs long-lived connections. One instance is assumed; multiple
instances require the Socket.IO Redis adapter. Run migrations before the new
build and keep `TRUST_PROXY` correct behind the platform proxy.

### Vercel (serverless)

`src/app.ts` default-exports the Express app, which is the entry Vercel's
Express preset looks for, so the REST API deploys with no extra configuration.
`src/server.ts` stays the long-running entry for Docker/VPS. The serverless
shape serves REST only:

- Socket.IO is attached in `src/server.ts`, so realtime chat is unavailable;
  the REST chat endpoints still work.
- `/api/events` (SSE) cannot hold a connection open. Use the
  `/api/content-version` polling fallback.
- The boot-time jobs (token cleanup, chat housekeeping) do not run. Use Vercel
  Cron Jobs if those need to happen.
- Set the three `IMAGEKIT_*` variables; there is no disk fallback.
- `NODE_ENV=production` still requires `FRONTEND_ORIGIN_CLIENT` and the four
  secrets of at least 32 characters in the project's environment variables.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm run storage:check            # verify every stored key exists in ImageKit
```

No automated tests are included. See `docs/MANUAL_QA.md` for the end-to-end
checklist and `docs/BACKEND_AUDIT.md` for the endpoint audit.
