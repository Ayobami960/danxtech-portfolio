import type { RequestHandler } from "express";
import { ACCESS_COOKIE } from "../config/constants.js";
import { readCookie } from "../lib/cookies.js";
import { verifyAccessToken } from "../lib/jwt.js";
import { serviceUnavailable, unauthorized } from "../lib/errors.js";
import { isServiceUnavailable } from "../lib/error-response.js";
import { findAdminById } from "../repositories/admin.repository.js";

const readAccessToken = (authorization: string | undefined): string | null => {
  if (!authorization) return null;
  const [scheme, token] = authorization.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
};

/**
 * Deny-by-default guard. Mounted once at the top of the admin router so a new
 * admin route can never be public by accident.
 */
export const requireAuth: RequestHandler = (request, _response, next) => {
  void (async () => {
    try {
      const token =
        readCookie(request, ACCESS_COOKIE) ??
        readAccessToken(request.get("authorization"));

      if (!token) {
        throw unauthorized();
      }

      const payload = await verifyAccessToken(token);

      let admin;
      try {
        admin = await findAdminById(payload.sub);
      } catch (error) {
        // A DB outage must not look like an invalid session: 401 would sign the
        // admin out and throw away a perfectly good cookie.
        if (isServiceUnavailable(error)) throw serviceUnavailable();
        throw error;
      }

      if (!admin) {
        throw unauthorized("Session is no longer valid.");
      }

      request.admin = admin;
      next();
    } catch (error) {
      next(error);
    }
  })();
};

/**
 * Alias used by routes that live outside the admin router (for example
 * `POST /api/v1/uploads/sign`). Every authenticated principal is the portfolio
 * owner, so the check is identical to `requireAuth`; the separate name keeps the
 * intent explicit at those call sites.
 */
export const requireAdmin: RequestHandler = requireAuth;
