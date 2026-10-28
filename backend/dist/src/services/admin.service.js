import argon2 from "argon2";
import { z } from "zod";
import { AppError, ERROR_CODES } from "../lib/errors.js";
import { countAdmins, createAdmin, } from "../repositories/admin.repository.js";
import { passwordPolicy } from "../lib/password-policy.js";
const ARGON2_OPTIONS = {
    type: argon2.argon2id,
    memoryCost: 19_456,
    timeCost: 2,
    parallelism: 1,
};
export const MIN_PASSWORD_LENGTH = 12;
export const hashPassword = (password) => argon2.hash(password, ARGON2_OPTIONS);
export const verifyPassword = async (hash, password) => {
    try {
        return await argon2.verify(hash, password);
    }
    catch {
        return false;
    }
};
export const toSafeAdmin = (admin) => ({
    id: admin.id,
    email: admin.email,
    totpEnabled: admin.totpEnabled,
    lastLoginAt: admin.lastLoginAt,
    createdAt: admin.createdAt,
});
const emailSchema = z.email().max(255);
/**
 * Create the one and only admin. Refuses a second account, a short password,
 * or an email that is not already lowercase (the DB constraint requires it).
 */
export const createAdminAccount = async (input) => {
    const email = input.email.trim().toLowerCase();
    const parsed = emailSchema.safeParse(email);
    if (!parsed.success) {
        throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, "A valid email address is required.");
    }
    if (input.password.length < MIN_PASSWORD_LENGTH) {
        throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
    }
    const policy = passwordPolicy(input.password, email);
    if (!policy.ok) {
        throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, policy.message);
    }
    if ((await countAdmins()) > 0) {
        throw new AppError(409, ERROR_CODES.CONFLICT, "An admin account already exists. This API allows exactly one.");
    }
    const admin = await createAdmin({
        email,
        passwordHash: await hashPassword(input.password),
    });
    return toSafeAdmin(admin);
};
//# sourceMappingURL=admin.service.js.map