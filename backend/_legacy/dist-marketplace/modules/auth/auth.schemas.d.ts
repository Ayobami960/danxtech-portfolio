import { z } from "zod";
export declare const registerSchema: z.ZodObject<{
    firstName: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    lastName: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    country: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    email: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    password: z.ZodString;
    role: z.ZodEnum<{
        client: "client";
        freelancer: "freelancer";
    }>;
}, z.core.$strip>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    password: z.ZodString;
}, z.core.$strip>;
export declare const updateAccountProfileSchema: z.ZodObject<{
    firstName: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    lastName: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
}, z.core.$strip>;
export declare const forgotPasswordSchema: z.ZodObject<{
    email: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
}, z.core.$strip>;
export declare const verifyEmailSchema: z.ZodObject<{
    email: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    code: z.ZodString;
}, z.core.$strip>;
export declare const resendOtpSchema: z.ZodObject<{
    email: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
}, z.core.$strip>;
/**
 * `refreshToken` is optional: the browser sends it in the httpOnly cookie, but a
 * Bearer client can post it in the body instead.
 */
export declare const refreshSchema: z.ZodOptional<z.ZodObject<{
    refreshToken: z.ZodOptional<z.ZodString>;
}, z.core.$strip>>;
export declare const handoffExchangeSchema: z.ZodObject<{
    code: z.ZodString;
}, z.core.$strip>;
export declare const resetPasswordSchema: z.ZodObject<{
    email: z.ZodPipe<z.ZodString, z.ZodTransform<string, string>>;
    code: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateAccountProfileInput = z.infer<typeof updateAccountProfileSchema>;
export type OtpInput = z.infer<typeof verifyEmailSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type HandoffExchangeInput = z.infer<typeof handoffExchangeSchema>;
