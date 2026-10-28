import type { RegisterInput, LoginInput, OtpInput, ResetPasswordInput, UpdateAccountProfileInput } from "./auth.schemas.js";
export interface AuthRequestContext {
    ip?: string;
    userAgent?: string;
}
export interface IssuedTokens {
    accessToken: string;
    refreshToken: string;
    sessionId: string;
}
export interface SafeAccount {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    country: string;
    role: "client" | "freelancer";
    emailVerified: boolean;
    identityVerified: boolean;
    isOnboardingComplete: boolean;
    createdAt: Date | null;
}
export declare const register: (input: RegisterInput) => Promise<{
    message: string;
}>;
export declare const verifyEmail: (input: OtpInput, context: AuthRequestContext) => Promise<{
    tokens: IssuedTokens;
    account: SafeAccount;
}>;
export declare const resendOtp: (emailInput: string) => Promise<void>;
export declare const login: (input: LoginInput, context: AuthRequestContext) => Promise<{
    tokens: IssuedTokens;
    account: SafeAccount;
}>;
export declare const refresh: (refreshToken: string, context: AuthRequestContext) => Promise<IssuedTokens>;
export declare const revokeSession: (sessionId: string | undefined) => Promise<void>;
export declare const revokeByRefreshToken: (refreshToken: string) => Promise<void>;
export declare const revokeAllSessions: (accountId: string) => Promise<void>;
export declare const authenticateAccessToken: (token: string) => Promise<{
    userId: string;
    role: "client" | "freelancer";
    sessionId: string;
    accountExists: boolean;
    isOnboarded: boolean;
    emailVerified: boolean;
}>;
export declare const getMe: (accountId: string) => Promise<SafeAccount>;
export declare const createHandoffCode: (accountId: string, sessionId: string) => Promise<{
    code: string;
    expiresIn: number;
}>;
export declare const exchangeHandoffCode: (code: string, context: AuthRequestContext) => Promise<{
    tokens: IssuedTokens;
    account: SafeAccount;
}>;
export declare const updateAccountProfile: (accountId: string, input: UpdateAccountProfileInput) => Promise<SafeAccount>;
export declare const forgotPassword: (emailInput: string) => Promise<void>;
export declare const resetPassword: (input: ResetPasswordInput) => Promise<void>;
export declare const getCookieNames: () => {
    access: string;
    refresh: string;
};
export declare const getTokenTtls: () => {
    access: number;
    refresh: number;
};
