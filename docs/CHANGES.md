# Changes

## Backend

No source changes. The existing implementation already satisfied the contract;
`docs/BACKEND_AUDIT.md` records the audit. Verified with typecheck, lint and
build.

## Admin (`/admin`)

Added pages:

- `src/features/hero/HeroPage.tsx`
- `src/features/about/AboutPage.tsx`
- `src/features/experience/ExperiencePage.tsx`
- `src/features/skills/SkillsPage.tsx`
- `src/features/security/SecurityPage.tsx`
- `src/features/credentials/CredentialsPage.tsx`
- `src/features/resume/ResumePage.tsx`
- `src/features/settings/SettingsPage.tsx`
- `src/features/account/AccountPage.tsx`
- `src/features/activity/ActivityPage.tsx`

Added component/config:

- `src/components/FormDialog.tsx`
- `.env.example`, `public/robots.txt`, `public/_redirects`, `public/_headers`,
  `vercel.json`
- `README.md` (replaced the Vite template)

Fixed:

- `src/api/baseQuery.ts` — correct `FetchBaseQueryError` status normalisation.
- `src/api/types.ts` — `ResumeInfo` union includes `{ available: false }`.
- `src/app/store.ts` — unused listener parameter, lint.
- `src/features/auth/thunks.ts` — removed unused helper.
- `src/features/auth/useIdleLogout.ts` — no impure `Date.now()` during render.
- `src/components/Shell.tsx` — no synchronous `setState` in the route effect.
- `src/features/inbox/ConversationList.tsx` — non-component export removed.
- `src/features/inbox/InboxPage.tsx` — key the thread by conversation.
- `src/features/inbox/Thread.tsx` — state reset via remount instead of effect.
- `src/features/uploads/uploadFile.ts` — dead initial assignment removed.

## Client (`/client`)

Added data/store/chat layers:

- `lib/site-types.ts`, `lib/site-data.ts`, `lib/api.ts` (rewritten to
  `GET /api/site`)
- `lib/store/siteSlice.ts`, `lib/store/publicApi.ts`, `lib/store/store.ts`,
  `lib/store/hooks.ts`, `lib/store/selectors.ts`,
  `lib/store/PublicStoreProvider.tsx`
- `lib/chat/types.ts`, `lib/chat/session.ts`, `lib/chat/api.ts`,
  `lib/chat/chatSlice.ts`, `lib/chat/connection.ts`, `lib/chat/store.ts`,
  `lib/chat/hooks.ts`, `lib/chat/ChatStoreProvider.tsx`
- `app/chat/layout.tsx`, `app/chat/page.tsx`,
  `components/chat/ChatScreen.tsx`

Modified:

- `app/page.tsx` — fetch the aggregate and wrap sections in the public store.
- `components/landing-page/HeroSection.tsx` — store-driven hero, terminal
  commands and resume link.
- `components/landing-page/AboutSection2.tsx` — about + credentials from store.
- `components/landing-page/ExperienceSection.tsx` — experience + education from
  credentials.
- `components/landing-page/SkillsSection.tsx`, `SecuritySection.tsx`,
  `ProjectsSection.tsx` — store-driven, no prop drilling.
- `components/landing-page/ContactSection.tsx` — RTK Query submission, settings,
  honeypot retained, field/server error mapping.
- `components/global/Navbar.tsx`, `components/global/Footer.tsx` — contact email
  from settings.
- `package.json`, `pnpm-lock.yaml` — added `@reduxjs/toolkit`, `react-redux`,
  `socket.io-client`.
- Lint fixes: `app/not-found.tsx`, `components/ProjectGalleryModal.tsx`,
  `components/landing-page/AboutSection.tsx` (entities/motion/ref).
- `README.md` (replaced the template).

## Docs

- `docs/BACKEND_AUDIT.md`
- `docs/ASSUMPTIONS.md`
- `docs/CHAT.md`
- `docs/MANUAL_QA.md`
- `docs/CHANGES.md` (this file)
