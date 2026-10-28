import { PROPOSAL_STATUSES } from "../../config/constants.js";
type SubmitProposalInput = {
    jobId: string;
    coverLetter: string;
    bidAmount: number;
    duration: string;
    screeningAnswers: string[];
};
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];
type ProposalPortfolio = {
    title: string;
    category: string;
    description: string;
    live_url: string | null;
    cover_image: {
        imageId: string;
        url: string;
    };
};
export declare const submitProposal: (freelancerId: string, input: SubmitProposalInput) => Promise<{
    proposal: {
        bid_amount: string;
        cover_letter: string;
        created_at: Date | null;
        duration: string;
        id: string;
        is_shortlisted: boolean;
        job_id: string;
        screening_answers: {
            question: string;
            answer: string;
        }[];
        sender_id: string;
        sender_type: string;
        status: string;
        updated_at: Date | null;
    };
    connects: number;
    clientId: string;
    jobTitle: string;
}>;
export declare const getFreelancerProposalMetadata: (freelancerId: string) => Promise<{
    proposals: {
        jobId: string;
        submittedAt: Date | null;
        status: string;
    }[];
    counts: {
        total: number;
        active: number;
        viewed: number;
        interviewed: number;
    };
}>;
export declare const getFreelancerProposals: (freelancerId: string) => Promise<{
    id: string;
    jobId: string;
    title: string;
    company: string | null;
    status: string;
    submittedAt: Date | null;
    budget: string;
    bidAmount: string;
    duration: string;
    coverLetter: string;
    skills: string[];
}[]>;
export declare const submitAgencyProposal: (agencyId: string, input: {
    jobId: string;
    coverLetter: string;
    bidAmount: number;
    duration: string;
    screeningAnswers: string[];
}) => Promise<{
    proposal: {
        bid_amount: string;
        cover_letter: string;
        created_at: Date | null;
        duration: string;
        id: string;
        is_shortlisted: boolean;
        job_id: string;
        screening_answers: {
            question: string;
            answer: string;
        }[];
        sender_id: string;
        sender_type: string;
        status: string;
        updated_at: Date | null;
    };
    connects: number;
    clientId: string;
    jobTitle: string;
    agencyName: string;
}>;
export declare const getAgencyProposalMetadata: (agencyId: string) => Promise<{
    proposals: {
        jobId: string;
        submittedAt: Date | null;
        status: string;
    }[];
    counts: {
        total: number;
        active: number;
        viewed: number;
        interviewed: number;
    };
}>;
export declare const getAgencyProposals: (agencyId: string) => Promise<{
    id: string;
    jobId: string;
    title: string;
    company: string | null;
    status: string;
    submittedAt: Date | null;
    budget: string;
    bidAmount: string;
    duration: string;
    coverLetter: string;
    skills: string[];
    clientRating: string | null;
    clientReviewCount: number | null;
    clientTotalSpent: string | null;
    conversationId: string | null;
}[]>;
export declare const getClientJobProposals: (clientId: string, jobId: string) => Promise<{
    id: string;
    conversationId: string | null;
    contractId: string | null;
    contractStatus: "ACTIVE" | "COMPLETED" | "PENDING" | null;
    senderId: string;
    senderType: string;
    freelancerId: string | null;
    verified: boolean | null;
    title: string | null;
    country: string | null;
    city: string | null;
    skills: string[] | null;
    languages: {
        language: string;
        proficiency: string;
    }[] | null;
    avatarUrl: string | null;
    coverLetter: string;
    bidAmount: string;
    duration: string;
    screeningAnswers: {
        question: string;
        answer: string;
    }[];
    status: string;
    submittedAt: Date | null;
    jobSuccessScore: number;
    rating: number;
    completedJobs: number;
    senderName: string | null;
    agencyTags?: string[];
    portfolios: ProposalPortfolio[];
    isShortlisted: boolean;
}[]>;
export declare const updateProposal: (proposalId: string, clientId: string, target: ProposalStatus) => Promise<{
    id: string;
    senderId: string;
    senderType: string;
    status: string;
    jobTitle: string;
    isShortlisted: boolean;
    changed: boolean;
}>;
export declare const shortlistProposal: (proposalId: string, clientId: string) => Promise<{
    id: string;
    isShortlisted: boolean;
}>;
export declare const startProposalInterview: (proposalId: string, clientId: string, openingMessage: string) => Promise<{
    conversationId: string;
    proposalId: string;
    senderType: string;
    freelancerId: string;
    jobTitle: string;
    connects: number;
}>;
export {};
