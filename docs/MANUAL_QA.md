# Manual QA

Prerequisites: backend running against your local database, Admin on
`localhost:5173`, Client on `localhost:3000`, SMTP configured if you want to
check email. Run `npm run admin:create` once.

## Admin auth

- [ ] Wrong password → generic "Invalid email or password"; repeat until lockout
      → "Too many attempts, try again later".
- [ ] Correct password → dashboard. Reload → still signed in (session refresh).
- [ ] Signed out, visit `/projects` → redirected to `/login?next=/projects`.
- [ ] Enable 2FA (Account): setup → QR + manual key → enter 6-digit code → 10
      recovery codes shown **once**. Reload → codes gone.
- [ ] Log out, log in with TOTP. Log out, log in with one recovery code; that
      code no longer works.
- [ ] Wrong 2FA code → "Invalid code"; failures count toward lockout.
- [ ] Sessions table: revoke a second browser's session; "sign out everywhere
      else" keeps this device only.
- [ ] Idle 28 min → warning; "Stay signed in" resets. 30 min → logout.
- [ ] Log out in tab A → tab B goes to `/login` and clears cached admin data.
- [ ] Change password with a wrong current password → error. With a valid new
      (≥12, not common, not containing your email local part) → all sessions
      revoked and back to `/login`.

## Content

- [ ] Create a draft project, then publish it; it appears on the Client within
      ~60 s. Feature it (confirm replacement of the previous featured project).
      Reorder by drag and by keyboard. Delete with confirmation.
- [ ] Upload a cover and gallery images (≤10); reorder; delete one; watch upload
      progress and cancel one upload.
- [ ] Edit Hero: name parts, phrases, intro, availability toggle, stats,
      socials. Client updates within ~60 s.
- [ ] Edit About, Experience (add/edit/delete/reorder), Skills, Credentials,
      Settings.
- [ ] Security: Focus areas, OWASP (covered toggle is optimistic), Stats.
- [ ] Resume: upload a PDF ≤5 MB; preview opens inline; download count rises
      after a Client download. Upload a second PDF → old file replaced. Delete →
      Client resume button disappears.
- [ ] Validation: empty required fields, long text, bad hex/URL, >15 tech,
      >10 gallery files → inline field errors or clear messages.
- [ ] Activity log shows your mutations; filter by entity.

## Chat

1. [ ] With Admin open, submit the Client contact form in another browser. The
       conversation appears instantly at the top of the inbox (badge/toast) and
       the owner email arrives.
2. [ ] With Admin closed, submit again → email only; open Admin later → it is
       in the list.
3. [ ] Open the thread (visitor messages marked read), reply, then "Send chat
       invite" with a note and email enabled. Visitor email arrives with the
       link.
4. [ ] Open the link → chat joins; `#t=` disappears from the address bar.
       Reload → the chat resumes (sessionStorage guest token).
5. [ ] Message both ways: real time, typing indicator, presence dot, delivered
       and read ticks. History persists.
6. [ ] Close the visitor tab; reply as Admin → "new reply" email arrives. A
       second reply within 10 minutes sends no extra email.
7. [ ] Visitor sends while Admin is away → owner email (throttled).
8. [ ] Revoke the invite → visitor is disconnected and the old link shows the
       revoked message. Resend → old link dead, new link works.
9. [ ] Set `invite_expires_at` in the DB to the past → link shows the expired /
       invalid state.
10. [ ] Close the conversation → composer disabled on both sides.
11. [ ] Block WebSockets (or use the empty `VITE_API_URL` proxy mode) → the
        ConnectionPill shows Degraded/Degraded polling and chat still works.
12. [ ] Flood messages → rate-limit message.
13. [ ] Paste HTML/script/very long text → rendered as plain text; 2000-char
        limit enforced; external links open with `noopener noreferrer nofollow`.
14. [ ] Delete the conversation from the Admin → it leaves the list.

## Boundaries

- [ ] `curl -i http://localhost:8000/api/admin/stats` without a session → JSON
      `401`, never HTML.
- [ ] Connect to `/admin` Socket.IO without a cookie or from a foreign Origin →
      rejected.
- [ ] Visit `/chat` without an invite and without a stored session → "This link
      isn't valid".
- [ ] Client with the API stopped → landing page renders from static fallbacks;
      contact form shows a network error with a direct-email fallback.
- [ ] No link to the Admin anywhere on the Client; `/admin` is `noindex` and
      `robots.txt` disallows everything.
- [ ] Redux DevTools: no tokens, `File` objects, socket instances or 2FA
      secrets in any store; nothing persisted to storage except the chat
      sessionStorage entry and non-sensitive notification prefs.

## Build gate

- [ ] `cd backend && npm run typecheck && npm run lint && npm run build`
- [ ] `cd admin && npm run lint && npm run build`
- [ ] `cd client && npm run lint && npm run build`
