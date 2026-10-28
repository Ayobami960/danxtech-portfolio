import { Router } from "express";
import { authenticate, authenticateOptional } from "../../middleware/auth.middleware.js";
import { authLimiter, otpLimiter } from "./auth-limiter.js";
import {
    changePasswordHandler, exchangeHandoff, forgotPassword, handoff, listSessionsHandler, login, logout, me, refresh, register, resendOtp, resetPassword,
    revokeOtherSessionsHandler, revokeSessionHandler, socketToken, updateMe, verifyEmail,
} from "./contacts.controller.js";
import {
    changePasswordSchema, forgotPasswordSchema, handoffExchangeSchema, loginSchema, refreshSchema, registerSchema, resendOtpSchema, resetPasswordSchema, updateAccountProfileSchema, verifyEmailSchema,
} from "./contacts.schemas.js";
import { validate } from "./validate.js";
import { assertSafeOrigin } from "./contacts.controller.js";

export const authRouter = Router();

authRouter.post("/register", authLimiter, validate(registerSchema), register);
authRouter.post("/login", authLimiter, validate(loginSchema), login);
authRouter.post("/logout", assertSafeOrigin, authenticateOptional, logout);
authRouter.post("/refresh", assertSafeOrigin, validate(refreshSchema), refresh);
authRouter.post("/forgot-password", authLimiter, otpLimiter, validate(forgotPasswordSchema), forgotPassword);
authRouter.post("/reset-password", authLimiter, otpLimiter, validate(resetPasswordSchema), resetPassword);
authRouter.post("/verify-email", authLimiter, otpLimiter, validate(verifyEmailSchema), verifyEmail);
authRouter.post("/resend-otp", authLimiter, otpLimiter, validate(resendOtpSchema), resendOtp);
authRouter.post("/handoff", authenticate, handoff);
authRouter.post("/handoff/exchange", assertSafeOrigin, validate(handoffExchangeSchema), exchangeHandoff);
authRouter.get("/me", authenticate, me);
authRouter.put("/me", authenticate, validate(updateAccountProfileSchema), updateMe);
authRouter.post("/change-password", authLimiter, authenticate, validate(changePasswordSchema), changePasswordHandler);
authRouter.get("/sessions", authenticate, listSessionsHandler);
authRouter.delete("/sessions", authenticate, revokeOtherSessionsHandler);
authRouter.delete("/sessions/:sessionId", authenticate, revokeSessionHandler);
// Realtime cannot send the httpOnly cookie from JavaScript, so the socket
// handshake asks for a short-lived token bound to the current session.
authRouter.get("/socket-token", authenticate, socketToken);