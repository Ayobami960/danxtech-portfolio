/**
 * Credits purchases whose Stripe webhook never arrived.
 *
 * Overlapping runs are skipped so a slow Stripe call cannot stack up, and the
 * work itself is idempotent, so a missed or repeated run is harmless.
 */
export declare const runConnectsReconciliation: () => Promise<void>;
/**
 * Starts the schedule and returns its timer so shutdown can stop it. The first
 * pass runs immediately, which is what recovers a purchase made while the
 * server was restarting.
 */
export declare const startConnectsReconciliation: () => NodeJS.Timeout;
