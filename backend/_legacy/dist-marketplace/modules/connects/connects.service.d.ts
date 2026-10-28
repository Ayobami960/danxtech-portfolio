import { type ConnectsPlan } from "../../config/constants.js";
export declare const cacheBalance: (freelancerId: string, balance: number) => Promise<void>;
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
export declare const getConnectsHistory: (freelancerId: string) => Promise<{
    id: string;
    type: string;
    description: string;
    amount: number;
    created_at: Date | null;
}[]>;
export declare const createConnectsCheckout: (freelancerId: string, purchasedConnects: ConnectsPlan) => Promise<string>;
export declare const completeConnectPurchase: (freelancerId: string, purchasedConnects: ConnectsPlan, paymentId: string) => Promise<number | undefined>;
export declare const getConnectsBalance: (freelancerId: string) => Promise<number>;
export type ConnectsReconcileResult = {
    scanned: number;
    credited: Array<{
        sessionId: string;
        freelancerId: string;
        connects: number;
    }>;
    skipped: number;
};
/**
 * Credits paid Checkout Sessions that have no purchase record yet.
 *
 * A webhook can be missed entirely (bad endpoint, downtime, a lost delivery),
 * which would leave a customer charged without Connects. This walks the Stripe
 * sessions created inside the lookback window and credits the missing ones.
 * `completeConnectPurchase` is keyed on the session id, so re-running this is
 * always safe.
 */
export declare const reconcileUncreditedPurchases: (lookbackHours?: number) => Promise<ConnectsReconcileResult>;
export declare const addAgencyConnects: (agencyId: string) => Promise<{
    agency_id: string | null;
    connects: number;
    created_at: Date | null;
    freelancer_id: string | null;
    id: string;
    updated_at: Date | null;
} | undefined>;
export declare const getAgencyConnectsBalance: (agencyId: string) => Promise<number>;
export declare const getAgencyConnectsHistory: (agencyId: string) => Promise<{
    id: string;
    type: string;
    description: string;
    amount: number;
    created_at: Date | null;
}[]>;
export declare const createAgencyConnectsCheckout: (ownerId: string, agencyId: string, purchasedConnects: ConnectsPlan) => Promise<string>;
export declare const completeAgencyConnectsPurchase: (agencyId: string, purchasedConnects: ConnectsPlan, paymentId: string) => Promise<void>;
