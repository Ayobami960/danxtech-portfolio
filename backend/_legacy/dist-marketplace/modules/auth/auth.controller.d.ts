import type { RequestHandler } from "express";
import type { CookieOptions } from "express";
export declare const sessionCookieOptions: (maxAge: number) => CookieOptions;
/**
 * Access tokens are returned to the caller as well as stored in the httpOnly
 * cookie, so a client can send them back as `Authorization: Bearer <token>`
 * (non-browser clients, or a dashboard that keeps its own copy).
 */
export interface TokenPayload {
    accessToken: string;
    refreshToken: string;
    tokenType: "Bearer";
    expiresIn: number;
}
declare const assertSafeOrigin: RequestHandler;
export declare const register: RequestHandler;
export declare const login: RequestHandler;
export declare const verifyEmail: RequestHandler;
export declare const resendOtp: RequestHandler;
export declare const refresh: RequestHandler;
export declare const logout: RequestHandler;
export declare const forgotPassword: RequestHandler;
export declare const resetPassword: RequestHandler;
export declare const handoff: RequestHandler;
export declare const exchangeHandoff: RequestHandler;
export declare const me: RequestHandler;
export declare const updateMe: RequestHandler;
export { assertSafeOrigin };
