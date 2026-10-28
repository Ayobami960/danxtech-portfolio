export class ApiError extends Error {
    statusCode;
    code;
    constructor(statusCode, message, 
    /**
     * Optional machine-readable reason. Clients use `TOKEN_EXPIRED` to know
     * that a single refresh attempt is worth trying before signing out.
     */
    code) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.name = "ApiError";
    }
}
//# sourceMappingURL=api-error.js.map