export declare const refreshConnectsCache: (freelancerId: string, balance: number) => Promise<void>;
export declare const getConnectsBalance: (freelancerId: string) => Promise<number>;
export declare const getConnectsHistory: (freelancerId: string) => Promise<{
    id: string;
    type: string;
    description: string;
    amount: number;
    createdAt: Date | null;
}[]>;
export declare const addConnects: (freelancerId: string) => Promise<{
    agency_id: string | null;
    connects: number;
    created_at: Date | null;
    freelancer_id: string | null;
    id: string;
    updated_at: Date | null;
} | undefined>;
export declare const chargeConnects: (freelancerId: string, description: string) => Promise<{
    id: string;
    freelancer_id: string | null;
    agency_id: string | null;
    connects: number;
    created_at: Date | null;
    updated_at: Date | null;
}>;
export declare const returnConnects: (freelancerId: string, description: string) => Promise<{
    id: string;
    freelancer_id: string | null;
    agency_id: string | null;
    connects: number;
    created_at: Date | null;
    updated_at: Date | null;
}>;
