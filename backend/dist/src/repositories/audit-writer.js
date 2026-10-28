import { logger } from "../config/logger.js";
import { hashIp } from "../lib/crypto.js";
import { createAuditLog } from "./audit.repository.js";
/**
 * Persist an audit entry. Failures are logged but never break the request that
 * triggered them: auditing must not become an availability dependency.
 */
export const audit = async (request, event) => {
    try {
        await createAuditLog({
            userId: event.userId ?? request.admin?.id ?? null,
            action: event.action,
            entity: event.entity,
            entityId: event.entityId ?? null,
            meta: event.meta ?? null,
            ipHash: hashIp(request.ip),
            userAgent: request.get("user-agent")?.slice(0, 1000) ?? null,
        });
    }
    catch (error) {
        logger.error({ err: error, action: event.action, requestId: request.id }, "Failed to write audit log");
    }
};
//# sourceMappingURL=audit-writer.js.map