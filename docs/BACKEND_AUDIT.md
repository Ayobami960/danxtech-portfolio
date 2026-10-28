# Backend readiness audit

Scope: `/backend` (Node + Express 5 + TypeScript + Drizzle + PostgreSQL). Audited against
`Read.md` sections 3, 4 and 9. Verification gate used here: `npm run typecheck`,
`npm run lint`, `npm run build`. No test suite is written or run (per the brief).

## Verdict

The backend already implements the full contract, including the live-chat module. **No
capability gaps were found and no backend source changes were required.** Everything the
Admin and Client need is present, validated with Zod `.strict()` schemas, guarded by
`requireAuth` + CSRF for `/api/admin/*`, and produces audit entries for mutations.

## Auth and account security

| Requirement | Exists? | Matches contract? | Action |
|---|---|---|---|
| `GET /api/auth/csrf` (JSON + CSRF cookie) | Yes | Yes | None |
| `POST /api/auth/login` (cookies, `requires2fa`) | Yes | Yes | None |
| `POST /api/auth/2fa/verify` (TOTP ±1 / recovery code) | Yes | Yes | None |
| `POST /api/auth/refresh` (rotation + reuse detection) | Yes | Yes | None |
| `POST /api/auth/logout` | Yes | Yes | None |
| `GET /api/auth/me` | Yes | Yes | None |
| `PATCH /api/auth/password` (revokes all sessions) | Yes | Yes | None |
| TOTP setup/enable/disable/regenerate + encrypted secret | Yes | Yes | None |
| Recovery codes (SHA-256, single use) | Yes | Yes | None |
| Sessions list / revoke one / revoke others | Yes | Yes | None |
| Lockout, password policy, security email alerts | Yes | Yes | None |
| Access 15 min / refresh 7 days, httpOnly cookies | Yes | Yes | None |

## Dashboard and content

| Area | Endpoints | Exists? | Action |
|---|---|---|---|
| Dashboard | `GET /api/admin/stats`, `GET /api/admin/activity` (page, pageSize, entity) | Yes | None |
| Hero | `GET|PUT /api/admin/hero` | Yes | None |
| Projects | list/create/get/update/delete, `PATCH /reorder`, `PATCH /:id/featured`, cover + gallery uploads, gallery reorder/delete | Yes | None |
| Resume | `GET/PUT/DELETE /api/admin/resume` (PDF ≤5 MB, safe replace) | Yes | None |
| Contact (legacy) | `POST /api/contact`, `/api/admin/messages*` | Yes | None |
| About singleton | `GET|PUT /api/admin/about` + public | Yes | None |
| Credentials | list/create/update/delete/reorder + public | Yes | None |
| Skills groups | list/create/update/delete/reorder + public | Yes | None |
| Experience | list/create/update/delete/reorder + public | Yes | None |
| Security focus / OWASP / stats | list/create/update/delete/reorder each + public | Yes | None |
| Site settings | `GET|PUT /api/admin/settings` + public | Yes | None |
| Public aggregate | `GET /api/site` (ETag + s-maxage/stale-while-revalidate, null singletons) | Yes | None |
| Public project shape | `{ id, slug, title, description, icon, accentColor, tech[], stats[], liveUrl, githubUrl, imageParent, imageBox[], featured }` | Yes | None |

## Live chat

| Requirement | Exists? | Action |
|---|---|---|
| Conversations + chat_messages schema (seq identity, idempotency key, counters) | Yes | None |
| Contact form → conversation + first message + owner email | Yes | None |
| `POST /api/chat/join` (hashed token, identical 404s, 410 closed) | Yes | None |
| Guest JWT scoped to one conversation (24 h, rejoin) | Yes | None |
| Guest REST: messages (cursor), send, seen | Yes | None |
| Admin REST: list/filters, unread-count, detail, messages, send, read, patch, delete, invite/resend/revoke | Yes | None |
| Socket.IO `/admin` (cookie + origin + 60 s revalidation) and `/chat` (guest token) | Yes | None |
| Events: message send/new/status, typing, seen, presence, conversation new/update, close/revoke, session revoked | Yes | None |
| Zod validation, token-bucket limits, per-conversation send quotas | Yes | None |
| Bidirectional throttled email notifications (10 min per conversation) | Yes | None |
| Housekeeping job (30-day auto-close, 90-day delete) + refresh cleanup | Yes | None |
| Invite lifecycle (7 days, hash-only, resend rotates, revoke disconnects) | Yes | None |

## Infrastructure

| Requirement | Status |
|---|---|
| CORS allowlist from `FRONTEND_ORIGIN` (CSV), credentials | Present |
| `trust proxy` configurable, production default 1 | Present |
| Helmet, compression, cookie parser, 100 kb JSON limit | Present |
| Origin check on Socket.IO handshakes | Present |
| Local media serving + S3 driver (skips `external/` keys on delete) | Present |
| Idempotent seed | Present (`src/db/seed.ts`, `seed/data.json`) |
| Health endpoint | `GET /api/health` |
| Error envelope `{ error: { code, message, details[] } }` | Present |
| Never logs message bodies or tokens | Present (request logger redacts) |

## Environment

Existing variables cover the contract. `TOTP_ENCRYPTION_KEY` exists and is optional until
2FA is used. Client/admin email links reuse `FRONTEND_ORIGIN` (first origin = client,
`*-admin.*` origin = admin). No new backend variables were introduced.

## Commands

```
cd backend
npm run typecheck   # passes
npm run lint        # passes
npm run build       # passes
```
