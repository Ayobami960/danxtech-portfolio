# Phase 0 audit — contact → verified live chat

Date: 2026-10-27 · Scope: backend, client, admin

## Flow status

| Product step | Status | Evidence |
|---|---|---|
| 1. Contact form submits | **Done** | `client/components/landing-page/ContactSection.tsx`, `backend/src/controllers/public.controller.ts` (`submitContact`), `backend/src/services/contact.service.ts` |
| 2. Admin notified on new conversation | **Partial** | `contact.service.ts` sends `sendOwnerNotification` with name/email/preview, but **no link to the conversation** (the conversation is created afterwards in `chat.service.createConversationFromContact`). Later visitor messages are throttled-notified in `notifyOwnerOfVisitorMessage` (with admin link). |
| 3. Visitor confirmation email | **Missing** | No visitor-facing mail is sent on contact submit; only the owner notification exists. |
| 4. Admin sends chat link / first reply carries it | **Partial** | Invite: `chat.service.sendInvite` + `InvitePanel` in `admin/src/features/inbox/Thread.tsx`. First-reply email (`notifyVisitorOfReply`) only sends when an invite is already active — no automatic invite. |
| 5a. Visitor enters email | **Missing** | Link goes straight to `POST /api/chat/join { token }`. |
| 5b. OTP sent | **Missing** | No OTP table, endpoint, template or rate limits. |
| 5c. OTP verified | **Missing** | — |
| 6. Real-time chat both ways | **Partial** | Socket.IO gateway (`backend/src/realtime/gateway.ts`), guest REST (`chat.public.controller.ts`), client chat UI (`client/components/chat/ChatScreen.tsx`), admin thread. Delivery/read/typing/presence/reconnect all present. |

## Security mismatch (critical)

`POST /api/chat/join` accepts only the invite token and returns a guest JWT immediately
(`chat.service.guestJoin`). Anyone with the email link is in — no identity check.
The invite token is also a **derivable** HMAC of conversation id + sentAt
(`backend/src/lib/invite.ts`), so the link is not a suitable sole credential.

Smallest fitting change:

- Keep invites as the *entry* credential, but they no longer grant a session.
- New `POST /api/chat/verify/request` and `POST /api/chat/verify/confirm`: email must match
  the conversation's visitor email; 6-digit OTP, hashed at rest, 10 min TTL, 5 attempts,
  60 s resend cooldown, identical generic response for a mismatch (no enumeration).
- On success issue the existing signed guest token (24 h) — returned in the body **and**
  set as an httpOnly cookie (`chat_session`). Visitor endpoints accept either.
- `POST /api/chat/join` becomes a session-based rejoin (same path, new requirement).
- Link becomes `/chat#c=<conversationId>&t=<token>`; both are required for OTP calls.

## Storage gaps

| Item | Status | Action |
|---|---|---|
| Images via ImageKit + key in DB | **Partial** | Project/gallery covers use `getStorage()`. Chat has no image column or upload route. Add `chat_messages.image_key` + upload endpoints (`/api/chat/images`, `/api/admin/conversations/:id/images`). |
| Resume bytes in PostgreSQL | **Missing** | `resumes` still stores `storage_key` and streams from ImageKit (`resume.service.ts`). Add `data bytea`, write/read bytes in the DB, keep `assertPdf`, download route, counter and safe order; delete the legacy ImageKit object after the row is written. |

## Chat data / admin gaps

| Item | Status | Action |
|---|---|---|
| Conversation status open/closed/archived | **Partial** | Enum has `new | open | closed`; no `archived`. Add enum value + admin action/filter. |
| Visitor verified state visible to admin | **Missing** | Add `conversations.visitor_verified_at`, expose `verifiedAt` in the invite view and show it in the invite panel. |
| Admin image rendering | **Missing** | Render `imageUrl` bubbles. |
| Unread document title / browser notification | **Partial** | Sidebar badge exists (`Shell.tsx`); no title badge or notification toggle. |

## Plan (order of work)

1. **Migration 0003** (dry run first, no apply without approval): OTP table, `visitor_verified_at`,
   chat image columns + relaxed body constraint, `resumes.data` bytea + nullable `storage_key`,
   `archived` enum value.
2. Backend: OTP lib/repository/service/routes/limits, session cookie, `/chat/join` rework,
   socket cookie support, image uploads, invite-on-first-reply, owner link + visitor confirmation
   + OTP templates, resume bytes.
3. Client: verification steps 1–2, rejoin, images, sign out, contact success copy.
4. Admin: verified invite state, image bubbles, archive action/filter, title badge.
5. Verify: `tsc --noEmit`, `eslint`, production builds for backend/client/admin.
