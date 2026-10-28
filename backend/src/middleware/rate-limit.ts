import rateLimitImport, {
  ipKeyGenerator,
  type Options,
  type RateLimitRequestHandler,
} from "express-rate-limit";
import type { Request, Response } from "express";
import { ERROR_CODES } from "../lib/errors.js";

type RateLimitFn = (options?: Partial<Options>) => RateLimitRequestHandler;

// Under NodeNext the default import can be typed as a namespace object. At
// runtime it is either the function or { default: function }.
const rateLimitModule = rateLimitImport as unknown as
  | RateLimitFn
  | { default: RateLimitFn };
const rateLimit: RateLimitFn =
  typeof rateLimitModule === "function"
    ? rateLimitModule
    : rateLimitModule.default;

type LimiterOptions = {
  windowMs: number;
  limit: number;
  keyGenerator?: (request: Request, response: Response) => string;
  skipSuccessfulRequests?: boolean;
};

const handler = (_request: Request, response: Response): void => {
  response.status(429).json({
    error: {
      code: ERROR_CODES.RATE_LIMITED,
      message: "Too many requests. Please try again later.",
    },
  });
};

export const createLimiter = ({
  windowMs,
  limit,
  keyGenerator,
  skipSuccessfulRequests,
}: LimiterOptions): RateLimitRequestHandler =>
  rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler,
    skipSuccessfulRequests: skipSuccessfulRequests ?? false,
    ...(keyGenerator ? { keyGenerator } : {}),
    // Trust proxy is configured deliberately at the app level; disabling the
    // library's own heuristic prevents spurious startup validation errors.
    validate: { trustProxy: false },
  });

/** 5 contact submissions per hour per IP. */
export const contactLimiter = (): ReturnType<typeof createLimiter> =>
  createLimiter({ windowMs: 60 * 60 * 1000, limit: 5 });

/** 5 login attempts per 15 minutes per IP. */
export const loginIpLimiter = (): ReturnType<typeof createLimiter> =>
  createLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    skipSuccessfulRequests: true,
  });

/** 5 login attempts per 15 minutes per email, independent of the IP. */
export const loginEmailLimiter = (): ReturnType<typeof createLimiter> =>
  createLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    skipSuccessfulRequests: true,
    keyGenerator: (request) => {
      const email =
        typeof request.body === "object" &&
        request.body !== null &&
        typeof (request.body as { email?: unknown }).email === "string"
          ? (request.body as { email: string }).email.trim().toLowerCase()
          : "";
      return email
        ? `email:${email}`
        : `ip:${ipKeyGenerator(request.ip ?? "unknown")}`;
    },
  });

/** Broad protection for the remaining auth endpoints. */
export const authLimiter = (): ReturnType<typeof createLimiter> =>
  createLimiter({ windowMs: 15 * 60 * 1000, limit: 30 });

/** 20 invite exchanges per hour per IP. */
export const chatJoinLimiter = (): ReturnType<typeof createLimiter> =>
  createLimiter({ windowMs: 60 * 60 * 1000, limit: 20 });

/** Guest REST fallbacks: generous but bounded. */
export const chatLimiter = (): ReturnType<typeof createLimiter> =>
  createLimiter({ windowMs: 60 * 1000, limit: 120 });

const emailFromBody = (request: Request): string => {
  const body: unknown = request.body;
  if (typeof body === "object" && body !== null) {
    const email = (body as { email?: unknown }).email;
    if (typeof email === "string" && email.trim()) {
      return email.trim().toLowerCase();
    }
  }
  return "";
};

/** OTP requests per IP: 10 per 15 minutes (covers spraying many links). */
export const chatVerifyIpLimiter = (): ReturnType<typeof createLimiter> =>
  createLimiter({ windowMs: 15 * 60 * 1000, limit: 10 });

/** OTP requests per email: 5 per 15 minutes, independent of the IP. */
export const chatVerifyEmailLimiter = (): ReturnType<typeof createLimiter> =>
  createLimiter({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    keyGenerator: (request) => {
      const email = emailFromBody(request);
      return email
        ? `email:${email}`
        : `ip:${ipKeyGenerator(request.ip ?? "unknown")}`;
    },
  });

/** OTP confirmations per IP: 30 per 15 minutes (each code allows 5 tries). */
export const chatVerifyConfirmLimiter = (): ReturnType<typeof createLimiter> =>
  createLimiter({ windowMs: 15 * 60 * 1000, limit: 30 });