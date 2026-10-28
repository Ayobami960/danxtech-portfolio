import type { RequestHandler } from "express";
export declare const requireClient: (request: Parameters<RequestHandler>[0]) => {
    userId: string;
    sessionId?: string;
    role: "client" | "freelancer";
    accountExists: boolean;
    isOnboarded: boolean;
    emailVerified: boolean;
};
export declare const createProposal: RequestHandler;
export declare const getProposalMetadata: RequestHandler;
export declare const getProposals: RequestHandler;
export declare const updateProposalStatus: RequestHandler;
export declare const interviewProposal: RequestHandler;
