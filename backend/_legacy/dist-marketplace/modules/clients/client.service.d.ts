export interface SaveClientProfileInput {
    userId: string;
    firstName: string;
    lastName: string;
    country: string;
    avatarUrl: string;
    professionalRole: string;
    companyName: string;
    companyWebsite: string;
    companySize: string;
    industry: string;
    companyDescription: string;
}
export interface ClientMetadataData {
    firstName: string;
    lastName: string;
    country: string;
    avatarUrl: string;
    professionalRole: string;
    companyName: string;
    companyWebsite: string;
    companySize: string;
    industry: string;
    companyDescription: string;
    joinedAt: Date | null;
    identityVerified: boolean;
    paymentMethodVerified: boolean;
}
export interface ClientProfileData extends ClientMetadataData {
    isOnboarded: true;
}
export declare const getClientProfile: (userId: string) => Promise<ClientMetadataData | null>;
export declare const saveClientProfile: (input: SaveClientProfileInput) => Promise<ClientProfileData>;
export interface ClientHiringOverview {
    totalSpent: number;
    completedContracts: number;
    rating: number;
    openJobs: number;
    totalHires: number;
    hireRate: number;
    averageResponseDays: number | null;
}
export declare const getClientHiringOverview: (clientId: string) => Promise<ClientHiringOverview>;
export interface ClientDashboardOverview {
    openJobs: number;
    totalProposals: number;
    newProposals: number;
    shortlistedProposals: number;
    activeContracts: number;
    totalContracts: number;
    totalSpent: number;
    currentlyFunded: number;
    inProgressContracts: Array<{
        id: string;
        title: string;
        progressPercent: number;
    }>;
    activeJobPosts: Array<{
        id: string;
        title: string;
        budget: number;
        level: string;
        duration: string;
        proposalCount: number;
    }>;
}
export declare const getClientDashboardOverview: (clientId: string) => Promise<ClientDashboardOverview>;
export interface ClientCompletedContract {
    id: string;
    title: string;
    talent: string;
    budget: number;
    completedAt: string | null;
    clientReview: {
        rating: number;
        text: string;
    } | null;
    talentReview: {
        rating: number;
        text: string;
    } | null;
}
export declare const getClientCompletedContracts: (clientId: string) => Promise<ClientCompletedContract[]>;
export declare const getClientFinanceManagementUrl: (clientId: string) => Promise<string>;
export interface MarketplaceSearchResult {
    id: string;
    accountType: "Freelancer" | "Agency";
    name: string;
    title: string;
    location: string;
    verified: boolean;
    skills: string[];
    jobSuccess: number;
    rating: number;
    avatarUrl: string | null;
}
export interface MarketplaceSearchPage {
    results: MarketplaceSearchResult[];
    hasMore: boolean;
}
export declare const searchMarketplace: (query: string, type: "all" | "freelancer" | "agency", pagination?: {
    limit?: number;
    offset?: number;
}) => Promise<MarketplaceSearchPage>;
