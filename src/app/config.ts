/**
 * VITE_API_URL is the backend base URL (e.g. https://api.example.com). When it
 * is empty the Admin talks to its own origin and relies on the dev proxy or the
 * host rewrite, which keeps the session cookie first-party.
 */
export const API_ORIGIN = (import.meta.env.VITE_API_URL ?? "").replace(/\/+$/, "");
export const API_BASE = `${API_ORIGIN}/api/v1`;

export const CLIENT_URL = (
  import.meta.env.VITE_CLIENT_URL || "http://localhost:3000"
).replace(/\/+$/, "");

/** Same-origin when VITE_API_URL is empty, otherwise the API origin. */
export const SOCKET_ORIGIN = API_ORIGIN || window.location.origin;

/** Absolute URL for stored/seed media in admin previews. */
export const resolveMediaUrl = (value: string | null | undefined): string | null => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/media/")) return `${API_ORIGIN}${value}`;
  return `${CLIENT_URL}/${value.replace(/^\/+/, "")}`;
};
