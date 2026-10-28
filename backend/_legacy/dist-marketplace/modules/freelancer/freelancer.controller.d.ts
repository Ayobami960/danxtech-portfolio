import type { RequestHandler } from "express";
export declare const requireFreelancer: (request: Parameters<RequestHandler>[0]) => {
    userId: string;
    sessionId?: string;
    role: "client" | "freelancer";
    accountExists: boolean;
    isOnboarded: boolean;
    emailVerified: boolean;
};
export type JobFeedFilters = {
    sort?: "best-match" | "recent" | undefined;
    levels?: string[] | undefined;
    durations?: string[] | undefined;
    minBudget?: number | undefined;
    maxBudget?: number | undefined;
    minProposals?: number | undefined;
    maxProposals?: number | undefined;
    paymentVerified?: boolean | undefined;
};
export declare const getLoggedInFreelancerProfileHandler: RequestHandler;
export declare const upsertFreelanceProfile: RequestHandler;
export declare const getFreelancerEarningsSummary: RequestHandler;
export declare const getFreelancerEarningsOverviewHandler: RequestHandler;
export declare const getFreelancerEarningsCertificate: RequestHandler;
export declare const getFreelancerPayoutManagementLink: RequestHandler;
export declare const getFreelancerJobFeed: RequestHandler;
export declare const getFreelancerJobDetails: RequestHandler;
export declare const getPublicFreelancer: RequestHandler;
export declare const searchPublicFreelancersHandler: RequestHandler;
