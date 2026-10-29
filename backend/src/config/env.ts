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

    /** Report database keys whose files are missing from ImageKit at boot. */
    STORAGE_INTEGRITY_CHECK: booleanString,

    /** ImageKit is the only media storage provider (see storage/index.ts). */
    IMAGEKIT_PUBLIC_KEY: optionalString,
    IMAGEKIT_PRIVATE_KEY: optionalString,
    /** Delivery endpoint: https://ik.imagekit.io/<imagekit_id>. */
    IMAGEKIT_URL_ENDPOINT: z.url().optional(),
    /** Legacy name for IMAGEKIT_URL_ENDPOINT, still accepted. */
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

    const urlEndpoint = value.IMAGEKIT_URL_ENDPOINT ?? value.IMAGEKIT_END_POINT;
    const missingStorage: string[] = [];
    if (!value.IMAGEKIT_PUBLIC_KEY) missingStorage.push("IMAGEKIT_PUBLIC_KEY");
    if (!value.IMAGEKIT_PRIVATE_KEY) missingStorage.push("IMAGEKIT_PRIVATE_KEY");
    if (!urlEndpoint) missingStorage.push("IMAGEKIT_URL_ENDPOINT");

    // ImageKit is the only storage provider, so a missing value is fatal rather
    // than a silent fall back to a disk that does not survive an invocation.
    if (missingStorage.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["IMAGEKIT_PRIVATE_KEY"],
        message: `ImageKit is the only media storage provider. Missing: ${missingStorage.join(", ")}.`,
      });
    }

    // A swap between the two keys is otherwise silent: the SDK constructor
    // accepts both, and only the private key authenticates an upload, so the
    // first image simply failed with a generic storage error.
    const publicKey = value.IMAGEKIT_PUBLIC_KEY;
    const privateKey = value.IMAGEKIT_PRIVATE_KEY;
    if (publicKey && privateKey) {
      if (publicKey === privateKey) {
        ctx.addIssue({
          code: "custom",
          path: ["IMAGEKIT_PRIVATE_KEY"],
          message:
            "IMAGEKIT_PUBLIC_KEY and IMAGEKIT_PRIVATE_KEY hold the same value; they are two different keys in the ImageKit dashboard.",
        });
      } else if (
        publicKey.startsWith("private_") ||
        privateKey.startsWith("public_")
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["IMAGEKIT_PRIVATE_KEY"],
          message:
            "The ImageKit keys look swapped: IMAGEKIT_PUBLIC_KEY must hold the public key (public_…) and IMAGEKIT_PRIVATE_KEY the private key (private_…).",
        });
      }
    }

    // The bare marketing host is not a delivery endpoint: every URL built
    // from it 404s. A custom domain on the account (e.g. cdn.example.com) is
    // still accepted, but the default endpoint must look like
    // https://ik.imagekit.io/<imagekit_id>.
    if (urlEndpoint) {
      let host: string;
      let pathname: string;
      try {
        const parsed = new URL(urlEndpoint);
        host = parsed.hostname.toLowerCase();
        pathname = parsed.pathname;
      } catch {
        host = "";
        pathname = "";
      }
      if (host === "imagekit.io" || host === "www.imagekit.io") {
        ctx.addIssue({
          code: "custom",
          path: ["IMAGEKIT_URL_ENDPOINT"],
          message:
            "IMAGEKIT_URL_ENDPOINT must be your ImageKit URL endpoint (https://ik.imagekit.io/<imagekit_id>), not the ImageKit website, otherwise uploaded images are not reachable.",
        });
      } else if (host === "ik.imagekit.io" && pathname === "/") {
        ctx.addIssue({
          code: "custom",
          path: ["IMAGEKIT_URL_ENDPOINT"],
          message:
            "IMAGEKIT_URL_ENDPOINT must include your ImageKit id, e.g. https://ik.imagekit.io/<imagekit_id>. The value https://ik.imagekit.io/ is the base host and is not a valid delivery endpoint.",
        });
      } else if (
        host?.endsWith(".imagekit.io") &&
        !pathname.startsWith("/")
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["IMAGEKIT_URL_ENDPOINT"],
          message:
            "IMAGEKIT_URL_ENDPOINT must end with the ImageKit delivery path, e.g. https://ik.imagekit.io/<imagekit_id> (a path of /<imagekit_id>).",
        });
      }
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
  /** ImageKit is the only media storage provider. */
  storage: {
    /** The SDK constructor requires it; server-side uploads only use the private key. */
    publicKey: string;
    privateKey: string;
    urlEndpoint: string;
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
    storage: {
      publicKey: value.IMAGEKIT_PUBLIC_KEY as string,
      privateKey: value.IMAGEKIT_PRIVATE_KEY as string,
      urlEndpoint: (value.IMAGEKIT_URL_ENDPOINT ??
        value.IMAGEKIT_END_POINT) as string,
    },
    resumeDownloadName: value.RESUME_DOWNLOAD_NAME,
    logLevel: value.LOG_LEVEL,
  });
};

export const env: AppEnv = loadEnv();
export const isProduction = env.isProduction;
