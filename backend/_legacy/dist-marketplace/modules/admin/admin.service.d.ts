export interface Pagination {
    limit: number;
    offset: number;
}
export interface PaginatedResult<T> {
    results: T[];
    hasMore: boolean;
}
export declare const getAdminOverviewTotals: () => Promise<{
    totals: {
        freelancers: number;
        clients: number;
        agencies: number;
        jobPosts: number;
        proposals: number;
        contracts: number;
        activeContracts: number;
    };
    volume: {
        totalContractValue: number;
        totalPaidOut: number;
        totalConnectsRevenue: number;
    };
}>;
export declare const getAdminOverviewActivity: (pagination: Pagination) => Promise<PaginatedResult<{
    type: string;
    id: string;
    title: string;
    createdAt: Date | null;
}>>;
export declare const getAdminAccounts: (pagination: Pagination) => Promise<PaginatedResult<{
    id: string;
    type: string;
    name: string;
    avatarUrl: string | null;
    email: string;
    verified: boolean;
    paymentVerified: boolean;
    onboarded: boolean;
    createdAt: Date | null;
}>>;
export declare const getAdminJobPosts: ({ limit, offset }: Pagination) => Promise<{
    results: {
        id: string;
        title: string;
        description: string;
        status: string;
        expertiseLevel: string;
        expectedDuration: string;
        skills: string[];
        milestones: {
            id: string;
            title: string;
            budget: number;
            dueDate: string;
        }[];
        screeningQuestions: string[] | null;
        attachments: {
            fileId: string;
            fileName: string;
            fileUrl: string;
            fileType: string;
            fileSize: number;
        }[] | null;
        clientId: string;
        companyName: string | null;
        companyWebsite: string | null;
        industry: string | null;
        companyDescription: string | null;
        clientEmail: string | null;
        createdAt: Date | null;
        updatedAt: Date | null;
        publishedAt: Date | null;
        hiredAt: Date | null;
        proposalCount: number;
        hireCount: number;
        totalBudget: number;
        clientName: string;
    }[];
    hasMore: boolean;
}>;
export declare const getAdminProposals: ({ limit, offset }: Pagination) => Promise<{
    results: {
        id: string;
        jobId: string;
        jobTitle: string;
        jobBudget: number;
        jobStatus: string;
        senderId: string;
        senderType: string;
        senderName: string;
        senderAvatarUrl: string | null;
        senderEmail: string | null;
        agencySpecialty: string | null;
        agencyWebsite: string | null;
        coverLetter: string;
        bidAmount: number;
        duration: string;
        screeningAnswers: {
            question: string;
            answer: string;
        }[];
        status: string;
        isShortlisted: boolean;
        createdAt: Date | null;
        updatedAt: Date | null;
    }[];
    hasMore: boolean;
}>;
export declare const getAdminContracts: ({ limit, offset }: Pagination) => Promise<{
    results: {
        id: string;
        title: string;
        status: "ACTIVE" | "COMPLETED" | "PENDING";
        totalAmount: number;
        jobId: string;
        proposalId: string;
        clientId: string;
        clientName: string;
        clientEmail: string | null;
        talentId: string | null;
        talentName: string;
        talentAvatarUrl: string | null;
        talentEmail: string | null;
        agencySpecialty: string | null;
        agencyWebsite: string | null;
        talentKind: string;
        createdAt: Date;
        updatedAt: Date;
        startedAt: Date | null;
        completedAt: Date | null;
        milestones: {
            id: string;
            contractId: string;
            title: string;
            dueDate: string;
            position: number;
            status: "ACTIVE" | "COMPLETED" | "PENDING";
            fundedAt: Date | null;
            submissionMessage: string | null;
            submissionDeliveryLink: string | null;
            completedAt: Date | null;
            amount: number;
        }[];
    }[];
    hasMore: boolean;
}>;
type AdminTransactionRow = {
    id: string;
    type: "MILESTONE_FUNDED";
    description: string;
    party: string;
    amount: number;
    createdAt: Date | null;
} | {
    id: string;
    type: "EARNING";
    description: string;
    party: string;
    amount: number;
    createdAt: Date | null;
} | {
    id: string;
    type: "PAYOUT";
    description: string;
    party: string;
    amount: number;
    createdAt: Date | null;
} | {
    id: string;
    type: "CONNECTS_PURCHASE";
    description: string;
    party: string;
    amount: number;
    createdAt: Date | null;
};
export declare const getAdminTransactions: (pagination: Pagination) => Promise<PaginatedResult<AdminTransactionRow>>;
export declare const getSystemHealth: () => Promise<{
    redis: {
        ok: false;
        error: string;
    } | ({
        ok: true;
    } & {
        ok: boolean;
        latencyMs: number;
    });
    database: {
        ok: false;
        error: string;
    } | ({
        ok: true;
    } & {
        ok: boolean;
        latencyMs: number;
    });
    nats: {
        ok: false;
        error: string;
    } | ({
        ok: true;
    } & {
        ok: boolean;
        latencyMs: number;
        server: string;
    });
    process: {
        uptimeSeconds: number;
        memory: NodeJS.MemoryUsage;
        loadAverage: number[];
        cpuCount: number;
        totalMemoryMb: number;
        freeMemoryMb: number;
        nodeVersion: string;
    };
    checkedAt: string;
}>;
export declare const scanRedisKeys: (pattern: string) => Promise<{
    keys: {
        key: string;
        type: string;
        ttl: number;
    }[];
    truncated: boolean;
}>;
export declare const getRedisKeyValue: (key: string) => Promise<{
    type: "none";
    ttl: number;
    value: null;
    truncated?: never;
} | {
    type: string;
    ttl: number;
    value: unknown;
    truncated: boolean;
}>;
export {};
