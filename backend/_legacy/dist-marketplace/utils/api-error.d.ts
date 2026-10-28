export declare class ApiError extends Error {
    readonly statusCode: number;
    /**
     * Optional machine-readable reason. Clients use `TOKEN_EXPIRED` to know
     * that a single refresh attempt is worth trying before signing out.
     */
    readonly code?: string | undefined;
    constructor(statusCode: number, message: string, 
    /**
     * Optional machine-readable reason. Clients use `TOKEN_EXPIRED` to know
     * that a single refresh attempt is worth trying before signing out.
     */
    code?: string | undefined);
}
