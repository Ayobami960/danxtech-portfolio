import { ApiError } from "../utils/api-error.js";
export const notFoundHandler = (_request, _response, next) => {
    next(new ApiError(404, "Route not found."));
};
//# sourceMappingURL=not-found-middleware.js.map