export const asyncHandler = (handler) => (request, response, next) => {
    void handler(request, response, next).catch(next);
};
//# sourceMappingURL=async-handler.js.map