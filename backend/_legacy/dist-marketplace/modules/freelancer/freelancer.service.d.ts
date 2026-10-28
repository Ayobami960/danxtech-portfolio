import type { FreelancerProfileData, SaveFreelancerProfileInput } from "./@types.js";
export declare const getJSSContribution: (rating: number) => number;
export interface JobFeedFilters {
    sort?: "best-match" | "recent" | undefined;
    levels?: string[] | undefined;
    durations?: string[] | undefined;
    minBudget?: number | undefined;
    maxBudget?: number | undefined;
    minProposals?: number | undefined;
    maxProposals?: number | undefined;
    paymentVerified?: boolean | undefined;
}
export declare const getFreelancerMonthlyEarnings: (userId: string) => Promise<{
    hasEarnings: boolean;
    currentMonthTotal: number;
    previousMonthTotal: number;
    series: Array<{
        month: string;
        total: number;
    }>;
}>;
export declare const getFreelancerEarningsOverview: (userId: string) => Promise<{
    available: number;
    pending: number;
    withdrawn: number;
    lifetime: number;
    totalFees: number;
    feeRatePercent: number;
    recentEarnings: {
        id: string;
        title: string;
        client: string;
        grossAmount: number;
        platformFeeAmount: number;
        amount: number;
        date: Date;
        availableAt: Date;
        status: "AVAILABLE" | "PENDING" | "WITHDRAWN";
    }[];
}>;
export type EarningsCertificateWindow = {
    label: string;
    total: number;
};
export type EarningsCertificateData = {
    freelancerName: string;
    professionalTitle: string;
    profileUrl: string;
    location: string;
    activeSince: Date;
    issuedAt: Date;
    windows: EarningsCertificateWindow[];
};
export declare const getFreelancerEarningsCertificateData: (userId: string) => Promise<EarningsCertificateData>;
export declare const getFreelancerPayoutManagementUrl: (userId: string) => Promise<string>;
export declare const getMatchedJobPostsBySkills: (skillList: string[], filters?: JobFeedFilters) => Promise<{
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
    companyName: string;
    clientCountry: string | null;
    paymentVerified: boolean;
    proposalCount: number;
    hireCount: number;
    clientTotalSpent: number;
    clientRating: number;
    clientReviewCount: number;
}[]>;
export declare const getFreelancerProfile: (userId: string) => Promise<FreelancerProfileData | null>;
export declare const saveFreelancerProfile: (input: SaveFreelancerProfileInput) => Promise<FreelancerProfileData>;
/** Job feed for the freelancer dashboard. */
export declare const getMatchedJobPosts: (userId: string, filters?: JobFeedFilters) => Promise<{
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
    companyName: string;
    clientCountry: string | null;
    paymentVerified: boolean;
    proposalCounts: number;
}[]>;
/** Single job post for the freelancer job details page. */
export declare const getFreelancerJobPost: (jobId: string) => Promise<{
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
    companyName: string;
    companyDescription: string;
    clientCountry: string | null;
    paymentVerified: boolean;
    clientJoinedAt: Date | null;
    proposalCounts: number;
}>;
export declare const getPublicFreelancerProfile: (profileId: string) => Promise<{
    id: string;
    name: string;
    avatarUrl: string | null;
    identityVerified: boolean;
    professional_title: string;
    professional_description: string;
    hourly_rate: string;
    country: string;
    city: string;
    availability_status: string;
    weekly_availability: string;
    experience_level: string;
    skills: string[];
    languages: {
        language: string;
        proficiency: string;
    }[];
    portfolios: {
        id: string;
        title: string;
        category: string;
        description: string;
        live_url: string | null;
        cover_image: {
            imageId: string;
            url: string;
        };
    }[];
    joined_at: Date | null;
} | null>;
export interface PublicTalentSummary {
    id: string;
    name: string;
    avatarUrl: string | null;
    title: string;
    location: string;
    verified: boolean;
    active: boolean;
    jobSuccess: number;
    completedProjects: number;
    rating: number;
    reviews: number;
    hourlyRate: number;
    skills: string[];
    summary: string;
}
export interface PublicTalentSearchFilters {
    query?: string | undefined;
    verifiedOnly?: boolean | undefined;
    availableOnly?: boolean | undefined;
    minRating?: number | undefined;
    minSuccess?: number | undefined;
    minRate?: number | undefined;
    maxRate?: number | undefined;
    sort?: "recommended" | "rating" | "success" | "projects" | "rate-low" | undefined;
}
export interface PublicTalentSearchPage {
    results: PublicTalentSummary[];
    hasMore: boolean;
}
export declare const searchPublicFreelancers: (filters: PublicTalentSearchFilters, pagination?: {
    limit?: number;
    offset?: number;
}) => Promise<PublicTalentSearchPage>;
