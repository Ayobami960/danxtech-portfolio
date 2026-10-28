import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import { AppError, ERROR_CODES } from "../lib/errors.js";

type TurnstileResponse = {
  success: boolean;
  "error-codes"?: string[];
};

/**
 * When TURNSTILE_SECRET is configured, require a valid token. Verification
 * errors fail closed so a broken verifier cannot silently disable the check.
 */
export const verifyTurnstile = async (
  token: string | undefined,
  remoteIp: string | undefined,
): Promise<void> => {
  if (!env.turnstileSecret) return;

  if (!token) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      "Human verification is required.",
    );
  }

  try {
    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          secret: env.turnstileSecret,
          response: token,
          ...(remoteIp ? { remoteip: remoteIp } : {}),
        }),
        signal: AbortSignal.timeout(5_000),
      },
    );

    const result = (await response.json()) as TurnstileResponse;
    if (!result.success) {
      logger.warn(
        { errors: result["error-codes"] },
        "Turnstile rejected a contact submission",
      );
      throw new AppError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        "Human verification failed. Please try again.",
      );
    }
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error({ err: error }, "Turnstile verification request failed");
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      "Human verification is temporarily unavailable.",
    );
  }
};
