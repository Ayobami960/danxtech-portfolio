import "dotenv/config";
import { z } from "zod";
const DEV_FALLBACKS = {
    JWT_ACCESS_SECRET: "development-access-secret-change-me-000000",
    JWT_REFRESH_SECRET: "development-refresh-secret-change-me-00000",
    CSRF_SECRET: "development-csrf-secret-change-me-00000000",
    IP_HASH_SALT: "development-ip-salt-change-me-0000000000",
};
const csv = (value) => (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
const optionalString = z
    .string()
    .trim()
    .optional()
    .transform((value) => (value === "" ? undefined : value));
const optionalSecret = (name) => z
    .string()
    .optional()
    .transform((value) => value === "" || value === undefined
    ? process.env.NODE_ENV === "production"
        ? undefined
        : DEV_FALLBACKS[name]
    : value)
    .refine((value) => value !== undefined, {
    message: `${name} is required in production.`,
})
    .refine((value) => value === undefined || value.length >= 32, {
    message: `${name} must be at least 32 characters.`,
});
const booleanString = z
    .enum(["true", "false"])
    .optional()
    .transform((value) => value === undefined ? undefined : value === "true");
const trustProxyValue = z
    .string()
    .optional()
    .transform((value) => {
    if (value === undefined || value === "")
        return undefined;
    if (value === "true")
        return true;
    if (value === "false")
        return false;
    const hops = Number(value);
    if (!Number.isInteger(hops) || hops < 0) {
        throw new Error("TRUST_PROXY must be true, false, or a non-negative integer.");
    }
    return hops;
});
const parseOrigins = (name, raw) => csv(raw).map((origin) => {
    try {
        const url = new URL(origin);
        if (!["http:", "https:"].includes(url.protocol))
            throw new Error();
        if (url.pathname !== "/" && url.pathname !== "")
            throw new Error();
        if (url.search || url.hash)
            throw new Error();
        return url.origin;
    }
    catch {
        throw new Error(`${name} contains an invalid origin: ${origin}`);
    }
});
const schema = z
    .object({
    NODE_ENV: z
        .enum(["development", "test", "production"])
        .default("development"),
    PORT: z.coerce.number().int().min(1).max(65_535).default(8080),
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),
    DATABASE_URL_TEST: optionalString,
    TRUST_PROXY: trustProxyValue,
    /** Public portfolio (client) origin(s). Comma-separated if more than one. */
    FRONTEND_ORIGIN_CLIENT: z.string().optional(),
    /** Admin app origin(s). Comma-separated if more than one. */
    FRONTEND_ORIGIN_ADMIN: z.string().optional(),
    FRONTEND_REVALIDATE_URL: z.url().optional(),
    REVALIDATE_SECRET: optionalString,
    JWT_ACCESS_SECRET: optionalSecret("JWT_ACCESS_SECRET"),
    JWT_REFRESH_SECRET: optionalSecret("JWT_REFRESH_SECRET"),
    CSRF_SECRET: optionalSecret("CSRF_SECRET"),
    IP_HASH_SALT: optionalSecret("IP_HASH_SALT"),
    /** 32-byte key (base64 or 64 hex chars) used to encrypt TOTP secrets. */
    TOTP_ENCRYPTION_KEY: optionalString,
    COOKIE_DOMAIN: optionalString,
    COOKIE_SAMESITE: z.enum(["lax", "strict", "none"]).default("lax"),
    ADMIN_EMAIL: optionalString,
    /** Optional non-interactive password for `npm run admin:create`. */
    ADMIN_PASSWORD: optionalString,
    ADMIN_IP_ALLOWLIST: z.string().optional(),
    OWNER_EMAIL: z.email().optional(),
    SMTP_HOST: optionalString,
    SMTP_PORT: z.coerce.number().int().min(1).max(65_535).optional(),
    SMTP_SECURE: booleanString.default(false),
    SMTP_USER: optionalString,
    SMTP_PASS: optionalString,
    MAIL_FROM: optionalString,
    TURNSTILE_SECRET: optionalString,
    STORAGE_DRIVER: z.enum(["local", "s3", "imagekit"]).default("local"),
    /** Report database keys whose files are missing from ImageKit at boot. */
    STORAGE_INTEGRITY_CHECK: booleanString,
    STORAGE_LOCAL_DIR: z.string().default("./storage"),
    PUBLIC_MEDIA_BASE_URL: optionalString,
    S3_ENDPOINT: z.url().optional(),
    S3_REGION: optionalString,
    S3_BUCKET: optionalString,
    S3_ACCESS_KEY_ID: optionalString,
    S3_SECRET_ACCESS_KEY: optionalString,
    S3_PUBLIC_BASE_URL: z.url().optional(),
    S3_FORCE_PATH_STYLE: booleanString.default(false),
    IMAGEKIT_PRIVATE_KEY: optionalString,
    IMAGEKIT_END_POINT: z.url().optional(),
    RESUME_DOWNLOAD_NAME: z
        .string()
        .default("Adetoye-Daniel-Kehinde-Resume.pdf"),
    LOG_LEVEL: z
        .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
        .default("info"),
})
    .superRefine((value, ctx) => {
    if (value.NODE_ENV === "production" && !value.FRONTEND_ORIGIN_CLIENT) {
        ctx.addIssue({
            code: "custom",
            path: ["FRONTEND_ORIGIN_CLIENT"],
            message: "FRONTEND_ORIGIN_CLIENT is required in production.",
        });
    }
    if (value.STORAGE_DRIVER === "s3") {
        const required = [
            "S3_ENDPOINT",
            "S3_REGION",
            "S3_BUCKET",
            "S3_ACCESS_KEY_ID",
            "S3_SECRET_ACCESS_KEY",
            "S3_PUBLIC_BASE_URL",
        ];
        for (const key of required) {
            if (!value[key]) {
                ctx.addIssue({
                    code: "custom",
                    path: [key],
                    message: `${key} is required when STORAGE_DRIVER=s3.`,
                });
            }
        }
    }
    if (value.STORAGE_DRIVER === "imagekit") {
        for (const key of ["IMAGEKIT_PRIVATE_KEY", "IMAGEKIT_END_POINT"]) {
            if (!value[key]) {
                ctx.addIssue({
                    code: "custom",
                    path: [key],
                    message: `${key} is required when STORAGE_DRIVER=imagekit.`,
                });
            }
        }
        // The bare marketing host is not a delivery endpoint: every URL built
        // from it 404s. A custom domain on the account is still accepted.
        if (value.IMAGEKIT_END_POINT) {
            let host;
            try {
                host = new URL(value.IMAGEKIT_END_POINT).hostname.toLowerCase();
            }
            catch {
                host = "";
            }
            if (host === "imagekit.io" || host === "www.imagekit.io") {
                ctx.addIssue({
                    code: "custom",
                    path: ["IMAGEKIT_END_POINT"],
                    message: "IMAGEKIT_END_POINT must be your ImageKit URL endpoint (https://ik.imagekit.io/<imagekit_id>), not the ImageKit website, otherwise uploaded images are not reachable.",
                });
            }
        }
    }
    for (const field of ["ADMIN_EMAIL", "OWNER_EMAIL"]) {
        const email = value[field];
        if (email && email !== email.toLowerCase()) {
            ctx.addIssue({
                code: "custom",
                path: [field],
                message: `${field} must be lowercase.`,
            });
        }
    }
});
const loadEnv = () => {
    const parsed = schema.safeParse(process.env);
    if (!parsed.success) {
        const issues = parsed.error.issues
            .map((issue) => `  - ${issue.path.join(".") || "env"}: ${issue.message}`)
            .join("\n");
        throw new Error(`Invalid environment configuration. Fix the following and restart:\n${issues}`);
    }
    const value = parsed.data;
    const isProduction = value.NODE_ENV === "production";
    const clientOrigins = parseOrigins("FRONTEND_ORIGIN_CLIENT", value.FRONTEND_ORIGIN_CLIENT);
    const adminOrigins = parseOrigins("FRONTEND_ORIGIN_ADMIN", value.FRONTEND_ORIGIN_ADMIN);
    const frontendOrigins = [...new Set([...clientOrigins, ...adminOrigins])];
    if (isProduction && clientOrigins.length === 0) {
        throw new Error("At least one FRONTEND_ORIGIN_CLIENT is required in production.");
    }
    if (value.COOKIE_SAMESITE === "none" && !isProduction) {
        // Browsers treat SameSite=None without Secure as invalid; surface it now.
        throw new Error('COOKIE_SAMESITE="none" requires a production (HTTPS) build.');
    }
    const smtpHost = value.SMTP_HOST;
    const smtp = smtpHost === undefined
        ? undefined
        : (() => {
            if (!value.SMTP_PORT ||
                !value.SMTP_USER ||
                !value.SMTP_PASS ||
                !value.MAIL_FROM) {
                throw new Error("SMTP_HOST requires SMTP_PORT, SMTP_USER, SMTP_PASS and MAIL_FROM.");
            }
            return {
                host: smtpHost,
                port: value.SMTP_PORT,
                secure: value.SMTP_SECURE ?? false,
                user: value.SMTP_USER,
                pass: value.SMTP_PASS,
                from: value.MAIL_FROM,
            };
        })();
    return Object.freeze({
        nodeEnv: value.NODE_ENV,
        isProduction,
        port: value.PORT,
        databaseUrl: value.DATABASE_URL,
        databaseUrlTest: value.DATABASE_URL_TEST,
        trustProxy: value.TRUST_PROXY === undefined
            ? isProduction
                ? 1
                : false
            : value.TRUST_PROXY,
        frontendOrigins,
        frontendRevalidateUrl: value.FRONTEND_REVALIDATE_URL,
        revalidateSecret: value.REVALIDATE_SECRET,
        jwtAccessSecret: value.JWT_ACCESS_SECRET,
        jwtRefreshSecret: value.JWT_REFRESH_SECRET,
        csrfSecret: value.CSRF_SECRET,
        ipHashSalt: value.IP_HASH_SALT,
        totpEncryptionKey: value.TOTP_ENCRYPTION_KEY,
        clientOrigin: clientOrigins[0],
        adminOrigin: adminOrigins[0],
        cookieDomain: value.COOKIE_DOMAIN,
        cookieSameSite: value.COOKIE_SAMESITE,
        adminEmail: value.ADMIN_EMAIL,
        adminPassword: value.ADMIN_PASSWORD,
        adminIpAllowlist: csv(value.ADMIN_IP_ALLOWLIST),
        ownerEmail: value.OWNER_EMAIL,
        smtp,
        turnstileSecret: value.TURNSTILE_SECRET,
        storageIntegrityCheck: value.STORAGE_INTEGRITY_CHECK ?? value.NODE_ENV !== "test",
        storage: {
            driver: value.STORAGE_DRIVER,
            localDir: value.STORAGE_LOCAL_DIR,
            publicMediaBaseUrl: value.PUBLIC_MEDIA_BASE_URL,
            s3: value.STORAGE_DRIVER === "s3"
                ? {
                    endpoint: value.S3_ENDPOINT,
                    region: value.S3_REGION,
                    bucket: value.S3_BUCKET,
                    accessKeyId: value.S3_ACCESS_KEY_ID,
                    secretAccessKey: value.S3_SECRET_ACCESS_KEY,
                    publicBaseUrl: value.S3_PUBLIC_BASE_URL,
                    forcePathStyle: value.S3_FORCE_PATH_STYLE ?? false,
                }
                : undefined,
            imagekit: value.STORAGE_DRIVER === "imagekit"
                ? {
                    privateKey: value.IMAGEKIT_PRIVATE_KEY,
                    urlEndpoint: value.IMAGEKIT_END_POINT,
                }
                : undefined,
        },
        resumeDownloadName: value.RESUME_DOWNLOAD_NAME,
        logLevel: value.LOG_LEVEL,
    });
};
export const env = loadEnv();
export const isProduction = env.isProduction;
//# sourceMappingURL=env.js.map