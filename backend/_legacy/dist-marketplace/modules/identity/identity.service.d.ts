import type Stripe from "stripe";
export declare const createIdentitySession: (accountId: string, role: "client" | "freelancer", context?: "agency") => Promise<string>;
export declare const completeIdentityVerification: (session: Stripe.Identity.VerificationSession) => Promise<void>;
