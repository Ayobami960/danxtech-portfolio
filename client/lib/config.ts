/**
 * Base URL of the Express API.
 *
 * Server Components prefer API_URL; browser code (the contact form) uses
 * NEXT_PUBLIC_API_URL because non-public env vars are not inlined by Next.
 * Both fall back to the local development port.
 */
const serverUrl =
  typeof window === "undefined" ? process.env.API_URL : undefined;

const configured =
  serverUrl ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:8000";

export const API_BASE_URL = configured.replace(/\/+$/, "");
