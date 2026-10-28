export type PayoutRunSummary = {
    checked: number;
    paid: number;
    skipped: number;
    failed: number;
};
export declare const processDuePayouts: () => Promise<PayoutRunSummary>;
