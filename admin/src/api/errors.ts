export type ApiError = {
  status: number | "FETCH_ERROR" | "TIMEOUT";
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
};

type ErrorEnvelope = {
  error?: {
    code?: unknown;
    message?: unknown;
    details?: unknown;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const toFieldErrors = (details: unknown): Record<string, string> | undefined => {
  if (!Array.isArray(details)) return undefined;
  const result: Record<string, string> = {};
  for (const detail of details) {
    if (!isRecord(detail)) continue;
    const path = typeof detail.path === "string" ? detail.path : null;
    const message = typeof detail.message === "string" ? detail.message : null;
    if (path && message && !result[path]) result[path] = message;
  }
  return Object.keys(result).length > 0 ? result : undefined;
};

export const normalizeError = (
  status: number | "FETCH_ERROR" | "TIMEOUT",
  payload: unknown,
): ApiError => {
  if (status === "FETCH_ERROR") {
    return {
      status,
      code: "NETWORK",
      message: "Cannot reach the API. Check your connection and try again.",
    };
  }
  if (status === "TIMEOUT") {
    return {
      status,
      code: "TIMEOUT",
      message: "The API took too long to respond.",
    };
  }

  if (isRecord(payload) && isRecord((payload as ErrorEnvelope).error)) {
    const error = (payload as ErrorEnvelope).error as Record<string, unknown>;
    return {
      status,
      code: typeof error.code === "string" ? error.code : "ERROR",
      message:
        typeof error.message === "string"
          ? error.message
          : "Something went wrong.",
      fieldErrors: toFieldErrors(error.details),
    };
  }

  return {
    status,
    code: status === 401 ? "UNAUTHORIZED" : "ERROR",
    message:
      status === 401
        ? "Your session has expired."
        : "Something went wrong. Please try again.",
  };
};

export const isApiError = (value: unknown): value is ApiError =>
  isRecord(value) && typeof value.message === "string" && "code" in value;

export const getFieldErrors = (error: unknown): Record<string, string> => {
  if (isApiError(error)) return error.fieldErrors ?? {};
  if (isRecord(error) && isRecord(error.data)) {
    return normalizeError(500, error.data).fieldErrors ?? {};
  }
  return {};
};

export const errorMessage = (error: unknown, fallback = "Something went wrong."): string => {
  if (isApiError(error)) return error.message;
  // Async thunks reject with `{ message }` built from the server's error
  // envelope, so surface that text instead of a generic fallback.
  if (
    isRecord(error) &&
    !(error instanceof Error) &&
    typeof error.message === "string" &&
    error.message !== ""
  ) {
    return error.message;
  }
  // Plain `Error`s are thrown by the upload helper (Cloudinary's own message),
  // so surface those instead of the generic fallback.
  if (error instanceof Error && error.message) return error.message;
  return fallback;
};
