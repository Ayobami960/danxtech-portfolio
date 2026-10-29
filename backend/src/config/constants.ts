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
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_RESUME_BYTES = 25 * 1024 * 1024;
export const MAX_GALLERY_IMAGES = 10;
export const MAX_CHAT_IMAGE_BYTES = 10 * 1024 * 1024;

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
