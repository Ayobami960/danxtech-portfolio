export class ApiError extends Error {
    constructor (
        public readonly statusCode: number,
        message: string,
        /**
         * Optional machine-readable reason. Clients use `TOKEN_EXPIRED` to know
         * that a single refresh attempt is worth trying before signing out.
         */
        public readonly code?: string,
    ) {
        super(message);
        this.name = "ApiError";
    }
}
