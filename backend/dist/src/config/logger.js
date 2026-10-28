import pino from "pino";
import { env } from "./env.js";
import { SERVICE_NAME } from "./constants.js";
const redactPaths = [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
    "password",
    "currentPassword",
    "newPassword",
    "*.password",
    "*.currentPassword",
    "*.newPassword",
    "passwordHash",
    "*.passwordHash",
    "token",
    "*.token",
    "refreshToken",
    "*.refreshToken",
    "authorization",
    "cookie",
];
export const logger = pino({
    name: SERVICE_NAME,
    level: env.logLevel,
    base: { service: SERVICE_NAME, env: env.nodeEnv },
    redact: {
        paths: redactPaths,
        censor: "[REDACTED]",
    },
    timestamp: pino.stdTimeFunctions.isoTime,
});
//# sourceMappingURL=logger.js.map