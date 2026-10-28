import { ApiError } from "../../utils/api-error.js";
export const validate = (schema) => (request, _response, next) => {
    const result = schema.safeParse(request.body);
    if (!result.success) {
        next(new ApiError(400, "Request validation failed."));
        return;
    }
    request.body = result.data;
    next();
};
//# sourceMappingURL=validate.js.map