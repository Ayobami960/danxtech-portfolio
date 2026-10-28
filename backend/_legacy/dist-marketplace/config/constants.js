import { ApiError } from "../utils/api-error.js";
export const API_PREFIX = "/api/v1";
export const SERVICE_NAME = "onemarketplace-services";
export const ACCOUNT_AUTH_CACHE_TTL_SECONDS = 10 * 60;
export const getAccountAuthCacheKey = (userId, role) => `account:auth:${userId}:${role}`;
export const requireText = (value, fieldName) => {
    if (typeof value !== "string" || !value.trim()) {
        throw new ApiError(400, `${fieldName} is required.`);
    }
    return value.trim();
};
export const requireWebsite = (value) => {
    const website = requireText(value, "Company website");
    try {
        const url = new URL(website);
        if (url.protocol !== "https:") {
            throw new Error("Unsupported protocol.");
        }
    }
    catch (error) {
        throw new ApiError(400, "Company website must be a valid HTTPS URL.");
    }
    return website;
};
export const INITIAL_CONNECTS = 60;
export const PROPOSAL_CONNECTS = 6;
export const PROPOSAL_STATUSES = [
    "VIEWED",
    "SHORTLISTED",
    "INTERVIEWED",
    "OFFER_SENT",
    "REJECTED",
    "HIRED",
];
export const getConnectsCacheKey = (userId) => `connects:${userId}:freelancer`;
export const getAgencyConnectsCacheKey = (agencyId) => `connects:${agencyId}:agency`;
export const CONNECTS_CACHE_TTL_SECONDS = 10 * 60;
/*
 * Safety net for purchases whose Stripe webhook never arrived. A background job
 * re-checks paid Checkout Sessions created within the lookback window and
 * credits any that have no purchase record yet.
 */
export const CONNECTS_RECONCILE_INTERVAL_MS = 5 * 60 * 1000;
export const CONNECTS_RECONCILE_LOOKBACK_HOURS = 48;
export const CONNECTS_PLANS = {
    20: 300,
    40: 600,
    80: 1200,
};
export const PLATFORM_FEE_RATE = 0.1;
export const EARNINGS_HOLD_PERIOD_DAYS = 5;
export const EARNINGS_HOLD_PERIOD_MS = EARNINGS_HOLD_PERIOD_DAYS * 24 * 60 * 60 * 1000;
// Stripe Connect's self-serve cross-border payouts only support transfers
// between these regions (platform side and connected-account side both
// have to be in this list) — see
// https://docs.stripe.com/connect/cross-border-payouts#availability.
// The payout cron only pays freelancers whose declared country is in this
// set; everyone else's earnings stay "Pending" until broader support
// (e.g. Stripe Global Payouts) is built.
export const STRIPE_PAYOUT_ELIGIBLE_COUNTRIES = new Set([
    "US",
    "GB",
    "CA",
    "CH",
    // EEA: EU member states + Iceland, Liechtenstein, Norway
    "AT",
    "BE",
    "BG",
    "HR",
    "CY",
    "CZ",
    "DK",
    "EE",
    "FI",
    "FR",
    "DE",
    "GR",
    "HU",
    "IE",
    "IT",
    "LV",
    "LT",
    "LU",
    "MT",
    "NL",
    "PL",
    "PT",
    "RO",
    "SK",
    "SI",
    "ES",
    "SE",
    "IS",
    "LI",
    "NO",
]);
//# sourceMappingURL=constants.js.map