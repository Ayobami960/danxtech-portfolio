import { z } from "zod";
const emailSchema = z.string().trim().email().max(320).transform((email) => email.toLowerCase());
const nameSchema = z.string().trim().min(1).max(80).transform((value) => value.replace(/\s+/g, " "));
const countrySchema = z.string().trim().min(2).max(80).transform((value) => value.replace(/\s+/g, " "));
const commonPasswords = new Set(["password123", "qwerty12345", "letmein123", "welcome123", "admin12345"]);
const passwordSchema = z.string().min(10).max(128).refine((password) => !commonPasswords.has(password.toLowerCase()), "Choose a less common password.");
export const registerSchema = z.object({
    firstName: nameSchema,
    lastName: nameSchema,
    country: countrySchema,
    email: emailSchema,
    password: passwordSchema,
    role: z.enum(["client", "freelancer"]),
});
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1).max(128) });
export const updateAccountProfileSchema = z.object({ firstName: nameSchema, lastName: nameSchema });
export const forgotPasswordSchema = z.object({ email: emailSchema });
export const verifyEmailSchema = z.object({ email: emailSchema, code: z.string().regex(/^\d{6}$/) });
export const resendOtpSchema = z.object({ email: emailSchema });
/**
 * `refreshToken` is optional: the browser sends it in the httpOnly cookie, but a
 * Bearer client can post it in the body instead.
 */
export const refreshSchema = z.object({
    refreshToken: z.string().trim().min(1).max(512).optional(),
}).optional();
export const handoffExchangeSchema = z.object({ code: z.string().trim().min(1).max(4096) });
export const resetPasswordSchema = z.object({ email: emailSchema, code: z.string().regex(/^\d{6}$/), password: passwordSchema });
//# sourceMappingURL=auth.schemas.js.map