type StoredImage = {
    imageId: string;
    url: string;
};
export interface AgencyPortfolioItem {
    id: string;
    title: string;
    category: string;
    description: string;
    liveUrl: string | null;
    coverImage: StoredImage;
}
export interface AgencyMember {
    id: string;
    freelancerId: string;
    profileId: string | null;
    name: string;
    avatarUrl: string | null;
    role: string;
    skills: string[];
    isOwner: boolean;
    rating: number;
    jobSuccessScore: number;
    completedProjects: number;
}
export interface AgencyWorkHistoryItem {
    id: string;
    title: string;
    client: string;
    status: "ACTIVE" | "COMPLETED";
    completed: Date | null;
    amount: number;
    rating: number | null;
    review: string | null;
    clientHasReviewed: boolean;
    freelancerHasReviewed: boolean;
}
export interface AgencyStats {
    totalEarning: number;
    completedJobs: number;
    ongoingJobs: number;
    reviewCount: number;
    jobSuccessScore: number;
    rating: number | null;
}
export interface AgencyData {
    id: string;
    name: string;
    professionalTitle: string | null;
    size: string;
    specialty: string;
    website: string | null;
    overview: string;
    tags: string[];
    avatarImage: StoredImage | null;
    isOnboarded: boolean;
    portfolio: AgencyPortfolioItem[];
    ownerLocation: string | null;
    ownerLanguages: string[];
    ownerLanguageDetails: Array<{
        language: string;
        proficiency: string;
    }>;
    members: AgencyMember[];
    createdAt: Date | null;
    stats: AgencyStats;
    workHistory: AgencyWorkHistoryItem[];
}
export interface CreateAgencyInput {
    ownerId: string;
    name: string;
    size: string;
    specialty: string;
    website?: string;
    overview: string;
}
export interface ImageInput {
    imageId?: string;
    url: string;
}
export interface UpdateAgencyPortfolioInput {
    title: string;
    category: string;
    description: string;
    liveUrl?: string;
    coverImage: ImageInput;
}
export interface UpdateAgencyInput {
    ownerId: string;
    name: string;
    professionalTitle: string;
    size: string;
    specialty: string;
    website?: string;
    overview: string;
    tags: string[];
    avatarImage?: ImageInput;
    portfolio: UpdateAgencyPortfolioInput[];
}
export declare const getAgencyMonthlyEarnings: (agencyId: string) => Promise<{
    hasEarnings: boolean;
    currentMonthTotal: number;
    previousMonthTotal: number;
    series: Array<{
        month: string;
        total: number;
    }>;
}>;
export declare const getAgencyEarningsOverview: (agencyId: string) => Promise<{
    available: number;
    pending: number;
    withdrawn: number;
    lifetime: number;
    totalFees: number;
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
export declare const getAgencyPayoutManagementUrl: (agencyId: string) => Promise<string>;
export declare const getAgencyByOwner: (ownerId: string) => Promise<AgencyData | null>;
export declare const getPublicAgencyProfile: (agencyId: string) => Promise<AgencyData | null>;
export declare const getAgencyForMember: (freelancerId: string) => Promise<AgencyData | null>;
export declare const createAgency: (input: CreateAgencyInput) => Promise<AgencyData>;
export declare const updateAgencyProfile: (input: UpdateAgencyInput) => Promise<AgencyData>;
export declare const getAgencyTags: (freelancerId: string) => Promise<string[] | null>;
export declare const getAgencyIdentityForOwner: (ownerId: string) => Promise<{
    id: string;
    name: string;
} | null>;
export declare const getAgencyIdForMember: (freelancerId: string) => Promise<string | null>;
export declare const getAgencyOwnerVerification: (agencyId: string) => Promise<{
    ownerId: string;
    identityVerified: boolean;
} | null>;
export declare const getAgencyIdentityForMember: (freelancerId: string) => Promise<{
    id: string;
    name: string;
    avatarUrl: string | null;
} | null>;
export declare const getAgencyOwnerId: (agencyId: string) => Promise<string | null>;
export declare const getAgencyTeamMemberIds: (agencyId: string) => Promise<string[]>;
export interface AgencyInvitationData {
    id: string;
    email: string;
    role: string;
    status: string;
    createdAt: Date;
    avatarUrl: string | null;
}
export declare const getAgencyInvitations: (agencyId: string) => Promise<AgencyInvitationData[]>;
export declare const inviteAgencyMember: (agencyId: string, agencyName: string, invitedBy: string, input: {
    email: string;
    role: string;
}) => Promise<AgencyInvitationData & {
    notifiedInApp: boolean;
}>;
export declare const cancelAgencyInvitation: (agencyId: string, invitationId: string) => Promise<void>;
export declare const resendAgencyInvitation: (agencyId: string, invitationId: string, agencyName: string) => Promise<{
    notifiedInApp: boolean;
}>;
export declare const updateAgencyInvitationRole: (agencyId: string, invitationId: string, role: string) => Promise<void>;
export declare const updateAgencyMemberRole: (agencyId: string, memberId: string, role: string) => Promise<void>;
export declare const removeAgencyMember: (agencyId: string, memberId: string) => Promise<void>;
export interface MyAgencyInvitation {
    id: string;
    agencyId: string;
    agencyName: string;
    agencyAvatar: {
        imageId: string;
        url: string;
    } | null;
    role: string;
    createdAt: Date;
}
export declare const getMyAgencyInvitations: (userId: string) => Promise<MyAgencyInvitation[]>;
export declare const respondToAgencyInvitation: (invitationId: string, userId: string, accept: boolean) => Promise<{
    accepted: boolean;
}>;
export interface PublicAgencySummary {
    id: string;
    name: string;
    avatarUrl: string | null;
    verified: boolean;
    tagline: string | null;
    description: string;
    specialty: string;
    location: string | null;
    teamSize: string;
    memberCount: number;
    minHourlyRate: number | null;
    rating: number;
    reviews: number;
    projects: number;
    success: number;
    skills: string[];
}
export interface PublicAgencyFilters {
    query?: string;
    specialty?: string;
    sizes?: string[];
    verifiedOnly?: boolean;
    maxRate?: number;
    sort?: "recommended" | "rating" | "projects" | "rate-low" | undefined;
}
export interface PublicAgencyFeedPage {
    results: PublicAgencySummary[];
    hasMore: boolean;
}
export declare const searchPublicAgencies: (filters: PublicAgencyFilters, pagination?: {
    limit?: number;
    offset?: number;
}) => Promise<PublicAgencyFeedPage>;
export {};
