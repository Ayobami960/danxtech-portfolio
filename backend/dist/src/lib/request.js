import { AppError, ERROR_CODES } from "./errors.js";
export const body = (request) => request.validated.body;
export const query = (request) => request.validated.query;
export const params = (request) => request.validated.params;
export const currentAdmin = (request) => {
    if (!request.admin) {
        throw new AppError(401, ERROR_CODES.UNAUTHORIZED, "Authentication required.");
    }
    return request.admin;
};
//# sourceMappingURL=request.js.map