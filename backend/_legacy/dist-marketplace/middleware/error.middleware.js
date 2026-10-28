import { ApiError } from "../utils/api-error.js";
export const errorHandler = (error, _request, response, _next) => {
    const statusCode = error instanceof ApiError ? error?.statusCode : 500;
    if (!(error instanceof ApiError)) {
        console.error("UNHANDLED_API_ERROR", {
            error,
        });
    }
    const message = error instanceof ApiError
        ? error.message
        : "An unexpected server error occurred.";
    response.status(statusCode).json({
        success: false,
        message,
        ...(error instanceof ApiError && error.code ? { code: error.code } : {}),
    });
};
//# sourceMappingURL=error.middleware.js.map