import { logger } from "../config/logger.js";
import { closeIdleConversations, deleteClosedConversations, } from "../repositories/conversation.repository.js";
import { deleteStaleCodes } from "../repositories/chat-verification.repository.js";
const INTERVAL_MS = 6 * 60 * 60 * 1000;
const IDLE_DAYS = 30;
const CLOSED_RETENTION_DAYS = 90;
/** Verification codes are unusable after 10 minutes; keep a day for debugging. */
const OTP_RETENTION_HOURS = 24;
const run = async () => {
    try {
        const closed = await closeIdleConversations(IDLE_DAYS);
        const deleted = await deleteClosedConversations(CLOSED_RETENTION_DAYS);
        const codes = await deleteStaleCodes(new Date(Date.now() - OTP_RETENTION_HOURS * 60 * 60 * 1000));
        if (closed > 0 || deleted > 0 || codes > 0) {
            logger.info({ closed, deleted, codes }, "Chat housekeeping: closed idle conversations, deleted old ones and stale codes");
        }
    }
    catch (error) {
        logger.error({ err: error }, "Chat housekeeping failed");
    }
};
export const startChatHousekeeping = () => {
    void run();
    const timer = setInterval(() => {
        void run();
    }, INTERVAL_MS);
    timer.unref();
    return () => clearInterval(timer);
};
//# sourceMappingURL=chat-housekeeping.js.map