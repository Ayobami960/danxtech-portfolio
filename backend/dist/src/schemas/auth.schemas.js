import { z } from "zod";
export const loginSchema = z
    .object({
    email: z.email().max(255),
    password: z.string().min(1).max(200),
})
    .strict();
export const changePasswordSchema = z
    .object({
    currentPassword: z.string().min(1).max(200),
    newPassword: z
        .string()
        .min(12, "New password must be at least 12 characters.")
        .max(200),
})
    .strict()
    .refine((value) => value.currentPassword !== value.newPassword, {
    message: "New password must be different from the current password.",
    path: ["newPassword"],
});
export const twoFactorVerifySchema = z
    .object({
    code: z.string().trim().min(6).max(20),
})
    .strict();
export const twoFactorEnableSchema = twoFactorVerifySchema;
export const twoFactorDisableSchema = z
    .object({
    password: z.string().min(1).max(200),
    code: z.string().trim().min(6).max(20),
})
    .strict();
export const passwordConfirmSchema = z
    .object({ password: z.string().min(1).max(200) })
    .strict();
//# sourceMappingURL=auth.schemas.js.map