import { logger } from "../config/logger.js";
import { deleteStaleRefreshTokens } from "../repositories/refresh-token.repository.js";
const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;
const runCleanup = async () => {
    try {
        const removed = await deleteStaleRefreshTokens();
        if (removed > 0) {
            logger.info({ removed }, "Deleted expired or stale refresh tokens");
        }
    }
    catch (error) {
        logger.error({ err: error }, "Refresh token cleanup failed");
    }
};
/**
 * Hourly cleanup of refresh tokens that are expired or were created more than
 * 30 days ago. Returns a stop function so tests and shutdown can clear it.
 */
export const startRefreshTokenCleanup = () => {
    void runCleanup();
    const timer = setInterval(() => {
        void runCleanup();
    }, CLEANUP_INTERVAL_MS);
    timer.unref();
    return () => clearInterval(timer);
};
//# sourceMappingURL=refresh-token-cleanup.js.map