import type { Request, Response } from "express";
import { sha256Hex } from "./crypto.js";

// Always revalidate: the SSE stream plus the tag webhook keep the public client
// current, and a shared cache must never serve a stale content document.
// The ETag still makes an unchanged document a cheap 304.
const CACHE_CONTROL = "no-cache";

const etagFor = (body: string): string => `"${sha256Hex(body).slice(0, 32)}"`;

const normalizeEtag = (value: string): string =>
  value.trim().replace(/^W\//, "").replace(/^"|"$/g, "");

/** Weak comparison against an `If-None-Match` header value (handles lists and `*`). */
export const etagMatches = (
  header: string | undefined,
  etag: string,
): boolean => {
  if (!header) return false;
  if (header.trim() === "*") return true;
  const target = normalizeEtag(etag);
  return header.split(",").map(normalizeEtag).includes(target);
};

/**
 * Send a cacheable public JSON document with a strong-enough ETag and 304
 * support. `no-store` is never used here: these documents are public content.
 */
export const sendCacheableJson = (
  request: Request,
  response: Response,
  payload: unknown,
  status = 200,
): void => {
  const body = JSON.stringify(payload);
  const etag = etagFor(body);
  response.setHeader("ETag", etag);
  response.setHeader("Cache-Control", CACHE_CONTROL);

  if (etagMatches(request.get("if-none-match"), etag)) {
    response.status(304).end();
    return;
  }

  response.status(status).type("application/json").send(body);
};
