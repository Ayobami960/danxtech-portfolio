import type { RequestHandler } from "express";
export declare const authenticate: RequestHandler;
export declare const isAuthenticated: RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>;
/**
 * Best-effort authentication: attaches the session when the request carries a
 * valid access token, but never rejects. `/auth/logout` uses it so a client
 * that only sends `Authorization: Bearer` still has its session revoked.
 */
export declare const authenticateOptional: RequestHandler;
export declare const requireRole: (...roles: Array<"client" | "freelancer">) => RequestHandler;
/**
 * Blocks dashboard activities until the role profile has been saved.
 * `isOnboarded` is read from the accounts row on every authenticated
 * request, so enforcement follows the persisted server-side state.
 */
export declare const requireOnboarded: RequestHandler;
