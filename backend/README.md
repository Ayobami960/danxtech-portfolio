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

`STORAGE_DRIVER` selects media storage: `imagekit` (production), `s3`, or `local`
(development only — it writes to disk, so it is rejected when
`NODE_ENV=production`). ImageKit needs `IMAGEKIT_PUBLIC_KEY`,
`IMAGEKIT_PRIVATE_KEY` and `IMAGEKIT_URL_ENDPOINT`; `IMAGEKIT_END_POINT` is
still accepted as a legacy alias. Uploaded files are held in memory, never on
disk, and each row stores the delivery `url`, the ImageKit `fileId` and the
storage key; deletes use the `fileId`. Seeded assets under `external/` are never
touched.

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
- Set `STORAGE_DRIVER=imagekit` (or `s3`). The local driver writes to an
  ephemeral filesystem.
- `NODE_ENV=production` still requires `FRONTEND_ORIGIN_CLIENT` and the four
  secrets of at least 32 characters in the project's environment variables.

## Verification

```bash
npm run typecheck
npm run lint
npm run build
npm run storage:check            # verify every stored key exists in ImageKit
npm run storage:migrate-local    # dry run: list images still stored locally
npm run storage:migrate-local -- --apply   # upload them to ImageKit
```

No automated tests are included. See `docs/MANUAL_QA.md` for the end-to-end
checklist and `docs/BACKEND_AUDIT.md` for the endpoint audit.
