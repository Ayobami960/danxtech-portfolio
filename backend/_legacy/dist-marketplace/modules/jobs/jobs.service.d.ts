import { job_posts } from "../../database/schema.js";
export declare const createJobPost: (userId: string, data: Omit<typeof job_posts.$inferInsert, "client_id">) => Promise<{
    attachments: {
        fileId: string;
        fileName: string;
        fileUrl: string;
        fileType: string;
        fileSize: number;
    }[] | null;
    client_id: string;
    created_at: Date | null;
    description: string;
    expected_duration: string;
    expertise_level: string;
    hired_at: Date | null;
    id: string;
    milestones: {
        id: string;
        title: string;
        budget: number;
        dueDate: string;
    }[];
    published_at: Date | null;
    screening_questions: string[] | null;
    skills: string[];
    status: string;
    title: string;
    total_budget: string;
    updated_at: Date | null;
} | undefined>;
export declare const getJobPosts: (userId: string, jobId?: string) => Promise<{
    id: string;
    client_id: string;
    title: string;
    description: string;
    expertise_level: string;
    expected_duration: string;
    skills: string[];
    total_budget: string;
    screening_questions: string[] | null;
    attachments: {
        fileId: string;
        fileName: string;
        fileUrl: string;
        fileType: string;
        fileSize: number;
    }[] | null;
    status: string;
    published_at: Date | null;
    hired_at: Date | null;
    created_at: Date | null;
    updated_at: Date | null;
    milestones: {
        id: string;
        title: string;
        budget: number;
        dueDate: string;
    }[];
    proposalCount: number;
    shortlistCount: number;
    hireCount: number;
}[]>;
export declare const updateJobPost: (userId: string, jobId: string, data: Partial<typeof job_posts.$inferInsert>) => Promise<{
    id: string;
    client_id: string;
    title: string;
    description: string;
    expertise_level: string;
    expected_duration: string;
    skills: string[];
    total_budget: string;
    milestones: {
        id: string;
        title: string;
        budget: number;
        dueDate: string;
    }[];
    screening_questions: string[] | null;
    attachments: {
        fileId: string;
        fileName: string;
        fileUrl: string;
        fileType: string;
        fileSize: number;
    }[] | null;
    status: string;
    published_at: Date | null;
    hired_at: Date | null;
    created_at: Date | null;
    updated_at: Date | null;
}>;
export declare const deleteJobPost: (userId: string, jobId: string) => Promise<{
    attachments: {
        fileId: string;
        fileName: string;
        fileUrl: string;
        fileType: string;
        fileSize: number;
    }[] | null;
    client_id: string;
    created_at: Date | null;
    description: string;
    expected_duration: string;
    expertise_level: string;
    hired_at: Date | null;
    id: string;
    milestones: {
        id: string;
        title: string;
        budget: number;
        dueDate: string;
    }[];
    published_at: Date | null;
    screening_questions: string[] | null;
    skills: string[];
    status: string;
    title: string;
    total_budget: string;
    updated_at: Date | null;
}>;
export declare const saveJobPost: (freelancerId: string, jobId: string) => Promise<{
    created_at: Date | null;
    freelancer_id: string;
    id: string;
    job_id: string;
}>;
export declare const getSavedJobPosts: (freelancerId: string) => Promise<{
    id: string;
    client_id: string;
    title: string;
    description: string;
    expertise_level: string;
    expected_duration: string;
    skills: string[];
    total_budget: string;
    milestones: {
        id: string;
        title: string;
        budget: number;
        dueDate: string;
    }[];
    screening_questions: string[] | null;
    attachments: {
        fileId: string;
        fileName: string;
        fileUrl: string;
        fileType: string;
        fileSize: number;
    }[] | null;
    status: string;
    published_at: Date | null;
    hired_at: Date | null;
    created_at: Date | null;
    updated_at: Date | null;
    savedAt: Date | null;
    companyName: string;
    paymentVerified: boolean;
    proposalCount: number;
}[]>;
export declare const removeSavedJobPost: (freelancerId: string, jobId: string) => Promise<{
    created_at: Date | null;
    freelancer_id: string;
    id: string;
    job_id: string;
}>;
export interface PublicJobFilters {
    query?: string;
    levels?: string[];
    minBudget?: number;
    maxBudget?: number;
    maxProposals?: number;
    paymentVerified?: boolean;
    sort?: "newest" | "budget" | "rating" | "proposals";
}
export interface PublicJobSummary {
    id: string;
    title: string;
    description: string;
    skills: string[];
    totalBudget: number;
    expectedDuration: string;
    expertiseLevel: string;
    publishedAt: Date | null;
    companyName: string;
    clientLocation: string | null;
    paymentVerified: boolean;
    clientRating: number;
    clientTotalSpent: number;
    proposalCount: number;
}
export interface PublicJobFeedPage {
    results: PublicJobSummary[];
    hasMore: boolean;
}
export declare const getPublicJobFeed: (filters: PublicJobFilters, pagination?: {
    limit?: number;
    offset?: number;
}) => Promise<PublicJobFeedPage>;
