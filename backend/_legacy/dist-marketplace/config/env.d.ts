import "dotenv/config";
/**
 * Strict, exact-match allowlist: scheme + host + port must be identical to one
 * of the ORIGINS_* / API_ALLOWED_ORIGINS values. There is deliberately no
 * wildcard and no `127.0.0.1` == `localhost` leniency in any environment, so a
 * misconfigured app is refused (and named in the error) instead of silently
 * trusted. Each frontend's origin must be listed in server/.env.
 */
export declare const isAllowedOrigin: (origin: string) => boolean;
export declare const env: {
    readonly port: number;
    readonly nodeEnv: string;
    readonly apiPrefix: "/api/v1";
    readonly allowedOrigins: string[];
    readonly socketOrigins: string[];
    readonly isAllowedOrigin: typeof isAllowedOrigin;
    readonly jwtAccessSecret: string;
    readonly otpHmacSecret: string;
    readonly accessTokenTtlSeconds: number;
    readonly refreshTokenTtlSeconds: number;
    readonly cookieDomain: string | undefined;
    readonly smtp: {
        readonly host: string | undefined;
        readonly port: number | undefined;
        readonly secure: boolean | undefined;
        readonly user: string | undefined;
        readonly pass: string | undefined;
        readonly from: string | undefined;
    };
    readonly superAdminEmail: string | undefined;
    readonly redis: {
        readonly host: string;
        readonly port: number;
        readonly password: string | undefined;
        readonly database: number;
    };
    readonly imageKitPrivateKey: string | undefined;
    readonly imageKitPublicKey: string | undefined;
    readonly imageKitUrlEndpoint: string | undefined;
    readonly freelancerProfile: {
        readonly maxPortfolioProjects: number;
        readonly maxSkills: number;
        readonly minSkills: number;
        readonly maxLanguages: number;
        readonly maxSkillLength: number;
        readonly maxTextLength: number;
        readonly maxDescriptionLength: number;
        readonly maxPortfolioDescriptionLength: number;
        readonly maxBase64ImageBytes: number;
    };
    readonly stripeSecretKey: string | undefined;
    readonly stripeWebhookKey: string | undefined;
    readonly stripeConnectsWebhookSecret: string | undefined;
    readonly stripeIdentityWebhookSecret: string | undefined;
    readonly dailyApiKey: string | undefined;
    readonly dailyWebhookSecret: string | undefined;
    readonly oneMinuteLogsApiKey: string | undefined;
    readonly adminDashboardPassword: string | undefined;
    readonly adminSessionSecret: string | undefined;
    readonly clientDashboard: string | undefined;
    readonly agencyDashboard: string | undefined;
    readonly connectsReconcileSecrets: string[];
    readonly freelancerDashboard: string | undefined;
    readonly natsUrl: string;
};
