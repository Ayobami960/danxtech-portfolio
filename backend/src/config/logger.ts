import { pino } from "pino";
import { env } from "./env.js";
import { SERVICE_NAME } from "./constants.js";

const redactPaths = [
  "req.headers.authorization",
  "req.headers.cookie",
  "req.headers['x-csrf-token']",
  "res.headers['set-cookie']",
  "password",
  "currentPassword",
  "newPassword",
  "code",
  "*.password",
  "*.currentPassword",
  "*.newPassword",
  "*.code",
  "passwordHash",
  "*.passwordHash",
  "password_hash",
  "*.password_hash",
  "totpSecretEnc",
  "*.totpSecretEnc",
  "totp_secret_enc",
  "*.totp_secret_enc",
  "token",
  "*.token",
  "csrfToken",
  "*.csrfToken",
  "refreshToken",
  "*.refreshToken",
  "accessToken",
  "*.accessToken",
  "authorization",
  "cookie",
];

/**
 * Log text can carry driver messages such as
 * `Failed query: select ... params: <uuid>,1`. Query parameter values and
 * credential identifiers are stripped before anything is written.
 */
export const redactLogText = (value: string): string =>
  value
    .replace(/\bparams:\s*[\s\S]*$/i, "params: [REDACTED]")
    .replace(
      /\b(password_hash|totp_secret_enc|passwordHash|totpSecretEnc)\b/gi,
      "[REDACTED]",
    )
    .replace(/\beyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}\b/g, "[REDACTED]")
    .slice(0, 4_000);

const serializeError = (error: unknown, depth = 0): Record<string, unknown> => {
  if (!(error instanceof Error)) {
    return { message: redactLogText(String(error)) };
  }

  const record = error as Error & { code?: unknown; cause?: unknown };
  return {
    type: error.name,
    message: redactLogText(error.message),
    ...(typeof record.code === "string" ? { code: record.code } : {}),
    ...(error.stack ? { stack: redactLogText(error.stack) } : {}),
    ...(depth < 3 && record.cause !== undefined
      ? { cause: serializeError(record.cause, depth + 1) }
      : {}),
  };
};

export const logger = pino({
  name: SERVICE_NAME,
  level: env.logLevel,
  base: { service: SERVICE_NAME, env: env.nodeEnv },
  redact: {
    paths: redactPaths,
    censor: "[REDACTED]",
  },
  serializers: {
    err: (error: unknown) => serializeError(error),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});
