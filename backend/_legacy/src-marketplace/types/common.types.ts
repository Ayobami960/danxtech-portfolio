export interface ApiResponse<T>{
    success: boolean;
    message: string;
    data?: T
    /** Machine-readable failure reason, present on some errors (e.g. TOKEN_EXPIRED). */
    code?: string
}


