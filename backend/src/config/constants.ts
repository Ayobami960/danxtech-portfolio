export const SERVICE_NAME = "portfolio-api";
export const API_PREFIX = "/api/v1";

export const CHAT_SESSION_COOKIE = "portfolio_chat";
export const ACCESS_COOKIE = "portfolio_access";
export const REFRESH_COOKIE = "portfolio_refresh";
export const CSRF_COOKIE = "portfolio_csrf";
export const TWO_FACTOR_COOKIE = "portfolio_2fa";

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
export const CSRF_TOKEN_TTL_SECONDS = 2 * 60 * 60;
export const TWO_FACTOR_CHALLENGE_TTL_SECONDS = 5 * 60;
export const GUEST_TOKEN_TTL_SECONDS = 24 * 60 * 60;
export const INVITE_TTL_DAYS = 7;
export const RECOVERY_CODE_COUNT = 10;

export const REFRESH_FAMILY_REVOKE_REASON = "token_reuse";

export const HERO_ID = "hero";
export const RESUME_ID = "resume";

export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 100;
/** Project cover/gallery uploads. Re-encoded to WebP before storage. */
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
/**
 * Vercel rejects serverless request bodies above ~4.5 MB before the function
 * runs, so a bigger multipart request never reaches multer. Refuse it with a
 * readable 413 while the body is still only a header.
 */
export const MAX_IMAGE_REQUEST_BYTES = 4.5 * 1024 * 1024;
export const MAX_RESUME_BYTES = 25 * 1024 * 1024;
export const MAX_GALLERY_IMAGES = 10;
export const MAX_CHAT_IMAGE_BYTES = 10 * 1024 * 1024;
/**
 * Base64 JSON document uploads (`POST /api/v1/admin/documents`). Base64 inflates
 * a payload by ~33%, so the decoded limit stays well inside Vercel's ~4.5 MB
 * request-body cap: 3 MB decodes to ~4.0 MB of base64 plus the JSON envelope.
 */
export const MAX_DOCUMENT_BYTES = 3 * 1024 * 1024;
/**
 * JSON parser limit for the document route only (100 kB everywhere else).
 * Sized just above the base64 encoding of MAX_DOCUMENT_BYTES (~4.19 MB) so the
 * decoded-size check, not a generic parser error, explains the 3 MB limit,
 * while staying under Vercel's ~4.5 MB request cap.
 */
export const MAX_DOCUMENT_JSON_LIMIT = 4_300_000;

/** Public display name used in chat UI and emails. */
export const CHAT_OWNER_NAME = "Adetoye Daniel Kehinde";

export const ABOUT_ID = "about";
export const SETTINGS_ID = "site";

export const REVALIDATE_TAGS = {
  hero: ["hero"],
  projects: ["projects"],
  resume: ["resume"],
  skills: ["skills"],
  experience: ["experience"],
  security: ["security"],
  /** About, credentials and site settings are grouped under one client tag. */
  site: ["site"],
} as const;
