import "dotenv/config";
import { z } from "zod";

const DEV_FALLBACKS = {
  JWT_ACCESS_SECRET: "development-access-secret-change-me-000000",
  JWT_REFRESH_SECRET: "development-refresh-secret-change-me-00000",
  CSRF_SECRET: "development-csrf-secret-change-me-00000000",
  IP_HASH_SALT: "development-ip-salt-change-me-0000000000",
} as const;

const csv = (value: string | undefined): string[] =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === "" ? undefined : value));

const optionalSecret = (name: keyof typeof DEV_FALLBACKS) =>
  z
    .string()
    .optional()
    .transform((value) =>
      value === "" || value === undefined
        ? process.env.NODE_ENV === "production"
          ? undefined
          : DEV_FALLBACKS[name]
        : value,
    )
    .refine((value) => value !== undefined, {
      message: `${name} is required in production.`,
    })
    .refine((value) => value === undefined || value.length >= 32, {
      message: `${name} must be at least 32 characters.`,
    });

const booleanString = z
  .enum(["true", "false"])
  .optional()
  .transform((value) => (value === undefined ? undefined : value === "true"));

const trustProxyValue = z
  .string()
  .optional()
  .transform((value) => {
    if (value === undefined || value === "") return undefined;
    if (value === "true") return true;
    if (value === "false") return false;
    const hops = Number(value);
    if (!Number.isInteger(hops) || hops < 0) {
      throw new Error(
        "TRUST_PROXY must be true, false, or a non-negative integer.",
      );
    }
    return hops;
  });

const parseOrigins = (name: string, raw: string | undefined): string[] =>
  csv(raw).map((origin) => {
    try {
      const url = new URL(origin);
      if (!["http:", "https:"].includes(url.protocol)) throw new Error();
      if (url.pathname !== "/" && url.pathname !== "") throw new Error();
      if (url.search || url.hash) throw new Error();
      return url.origin;
    } catch {
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

    /** Report database keys whose files are missing from Cloudinary at boot. */
    STORAGE_INTEGRITY_CHECK: booleanString,

    /**
     * Cloudinary cloud name, e.g. "my-portfolio".
     * Shared with the browser's direct-to-Cloudinary signed uploads.
     */
    CLOUDINARY_CLOUD_NAME: z.string().min(1, "CLOUDINARY_CLOUD_NAME is required."),
    /** Public API key. Sent to the browser as part of the signed upload params. */
    CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY is required."),
    /** Private API secret. Only used server-side to sign uploads and deletes. */
    CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET is required."),
    /** Optional custom delivery domain, e.g. https://cdn.example.com. */
    CLOUDINARY_DELIVERY_URL: z.url().optional(),

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

    const cloudName = value.CLOUDINARY_CLOUD_NAME;
    const apiKey = value.CLOUDINARY_API_KEY;
    const apiSecret = value.CLOUDINARY_API_SECRET;
    if (!cloudName) {
      ctx.addIssue({
        code: "custom",
        path: ["CLOUDINARY_CLOUD_NAME"],
        message: "CLOUDINARY_CLOUD_NAME is required.",
      });
    }
    if (!apiKey) {
      ctx.addIssue({
        code: "custom",
        path: ["CLOUDINARY_API_KEY"],
        message: "CLOUDINARY_API_KEY is required.",
      });
    }
    if (!apiSecret) {
      ctx.addIssue({
        code: "custom",
        path: ["CLOUDINARY_API_SECRET"],
        message: "CLOUDINARY_API_SECRET is required.",
      });
    }

    for (const field of ["ADMIN_EMAIL", "OWNER_EMAIL"] as const) {
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

export type AppEnv = Readonly<{
  nodeEnv: "development" | "test" | "production";
  isProduction: boolean;
  port: number;
  databaseUrl: string;
  databaseUrlTest: string | undefined;
  trustProxy: boolean | number;
  /** Combined client + admin origins (used for CORS). */
  frontendOrigins: string[];
  frontendRevalidateUrl: string | undefined;
  revalidateSecret: string | undefined;
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  csrfSecret: string;
  ipHashSalt: string;
  totpEncryptionKey: string | undefined;
  /** First FRONTEND_ORIGIN_CLIENT: the public portfolio (chat links). */
  clientOrigin: string | undefined;
  /** First FRONTEND_ORIGIN_ADMIN, if configured. */
  adminOrigin: string | undefined;
  cookieDomain: string | undefined;
  cookieSameSite: "lax" | "strict" | "none";
  adminEmail: string | undefined;
  adminPassword: string | undefined;
  adminIpAllowlist: string[];
  ownerEmail: string | undefined;
  smtp:
    | {
        host: string;
        port: number;
        secure: boolean;
        user: string;
        pass: string;
        from: string;
      }
    | undefined;
  turnstileSecret: string | undefined;
  /** Defaults to true, except under NODE_ENV=test. */
  storageIntegrityCheck: boolean;
  /** Cloudinary cloud + keys. The browser also receives CLOUDINARY_CLOUD_NAME and CLOUDINARY_API_KEY as part of a signed upload. */
  cloudinary: {
    cloudName: string;
    apiKey: string;
    apiSecret: string;
    deliveryUrl: string | undefined;
  };
  resumeDownloadName: string;
  logLevel: "fatal" | "error" | "warn" | "info" | "debug" | "trace" | "silent";
}>;

const loadEnv = (): AppEnv => {
  const parsed = schema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Invalid environment configuration. Fix the following and restart:\n${issues}`,
    );
  }

  const value = parsed.data;
  const isProduction = value.NODE_ENV === "production";

  const clientOrigins = parseOrigins(
    "FRONTEND_ORIGIN_CLIENT",
    value.FRONTEND_ORIGIN_CLIENT,
  );
  const adminOrigins = parseOrigins(
    "FRONTEND_ORIGIN_ADMIN",
    value.FRONTEND_ORIGIN_ADMIN,
  );
  const frontendOrigins = [...new Set([...clientOrigins, ...adminOrigins])];

  if (isProduction && clientOrigins.length === 0) {
    throw new Error(
      "At least one FRONTEND_ORIGIN_CLIENT is required in production.",
    );
  }

  if (value.COOKIE_SAMESITE === "none" && !isProduction) {
    // Browsers treat SameSite=None without Secure as invalid; surface it now.
    throw new Error(
      'COOKIE_SAMESITE="none" requires a production (HTTPS) build.',
    );
  }

  const smtpHost = value.SMTP_HOST;
  const smtp =
    smtpHost === undefined
      ? undefined
      : (() => {
          if (
            !value.SMTP_PORT ||
            !value.SMTP_USER ||
            !value.SMTP_PASS ||
            !value.MAIL_FROM
          ) {
            throw new Error(
              "SMTP_HOST requires SMTP_PORT, SMTP_USER, SMTP_PASS and MAIL_FROM.",
            );
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
    trustProxy:
      value.TRUST_PROXY === undefined
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
    storageIntegrityCheck:
      value.STORAGE_INTEGRITY_CHECK ?? value.NODE_ENV !== "test",
    cloudinary: {
      cloudName: value.CLOUDINARY_CLOUD_NAME as string,
      apiKey: value.CLOUDINARY_API_KEY as string,
      apiSecret: value.CLOUDINARY_API_SECRET as string,
      deliveryUrl: value.CLOUDINARY_DELIVERY_URL as string | undefined,
    },
    resumeDownloadName: value.RESUME_DOWNLOAD_NAME,
    logLevel: value.LOG_LEVEL,
  });
};

export const env: AppEnv = loadEnv();
export const isProduction = env.isProduction;

export type CloudinaryEnv = AppEnv["cloudinary"];