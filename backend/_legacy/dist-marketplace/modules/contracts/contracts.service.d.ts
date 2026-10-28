import type Stripe from "stripe";
export declare const createContractCheckout: (clientId: string, proposalId: string) => Promise<string>;
export declare const createMilestoneFundingCheckout: (clientId: string, contractId: string, milestoneId: string, requirements?: string) => Promise<string>;
export declare const fundContractMilestoneFromPayment: (session: Stripe.Checkout.Session) => Promise<void>;
export declare const getAccountContracts: (userId: string, role: "client" | "freelancer" | "agency", agencyId?: string | null) => Promise<any[]>;
export declare const finishContractWithReview: (contractId: string, reviewerId: string, role: "client" | "freelancer", rating: number, comment: string, agencyId?: string | null) => Promise<{
    id: string;
    title: string;
    revieweeId: string;
    agencyId: string | null;
    conversationId: string | null;
    newlyCompleted: boolean;
}>;
export declare const acceptContract: (contractId: string, freelancerId: string, agencyId?: string | null) => Promise<{
    id: string;
    title: string;
    status: "ACTIVE" | "COMPLETED" | "PENDING";
    clientId: string;
    agencyId: string | null;
    identityVerified: boolean;
    conversationId: string;
    milestoneId: string;
    freelancerId: string;
}>;
export declare const submitContractMilestone: (contractId: string, milestoneId: string, freelancerId: string, submissionMessage: string, submissionDeliveryLink?: string, agencyId?: string | null) => Promise<{
    contractId: string;
    contractTitle: string;
    contractStatus: "ACTIVE" | "COMPLETED" | "PENDING";
    clientId: string;
    milestoneId: string;
    milestoneTitle: string;
    milestoneAmount: string;
    milestoneStatus: "ACTIVE" | "COMPLETED" | "PENDING";
    fundedAt: Date | null;
    conversationId: string;
}>;
export declare const reviewContractMilestone: (contractId: string, milestoneId: string, clientId: string, action: "APPROVE" | "REQUEST_CHANGES", feedback?: string) => Promise<{
    contractId: string;
    contractTitle: string;
    agencyId: string | null;
    milestoneId: string;
    milestoneTitle: string;
    milestoneAmount: string;
    milestoneStatus: "ACTIVE" | "COMPLETED" | "PENDING";
    paymentRequestedAt: Date | null;
    conversationId: string;
    approved: boolean;
    freelancerId: string;
}>;
export declare const addContractMilestone: (contractId: string, clientId: string, input: {
    title: string;
    amount: number;
    dueDate: string;
}) => Promise<{
    id: string;
    title: string;
    amount: number;
    dueDate: string;
    status: "PENDING";
}>;
export declare const createContractFromPayment: (session: Stripe.Checkout.Session) => Promise<void>;
