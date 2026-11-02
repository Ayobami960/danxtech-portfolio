/**
 * The browser only ever sees same-origin, relative API paths. The Vite dev
 * proxy and the host rewrite (vercel.json) forward `/api` to the backend, so:
 *   - no backend URL is baked into the bundle,
 *   - the session cookie stays first-party (no CORS, no SameSite=None),
 *   - CSP only needs `'self'` plus the Cloudinary upload host used by
 *     browser-direct uploads.
 */
export const API_BASE = "/api/v1";

export const CLIENT_URL = (
  import.meta.env.VITE_CLIENT_URL || "http://localhost:3000"
).replace(/\/+$/, "");

/** Same origin as the admin app; Socket.IO rides the same proxy/rewrite. */
export const SOCKET_ORIGIN =
  typeof window === "undefined" ? "" : window.location.origin;

/** Absolute URL for stored/seed media in admin previews. */
export const resolveMediaUrl = (value: string | null | undefined): string | null => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/media/")) return value;
  return `${CLIENT_URL}/${value.replace(/^\/+/, "")}`;
};
