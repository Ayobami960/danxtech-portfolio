import { and, count, desc, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { adminUsers, auditLogs } from "../database/schema.js";
export const createAuditLog = async (input) => {
    await db.insert(auditLogs).values(input);
};
export const listAuditLogs = async (page, pageSize, entity) => {
    const where = entity
        ? and(eq(auditLogs.entity, entity))
        : undefined;
    const [rows, totals] = await Promise.all([
        db
            .select({
            id: auditLogs.id,
            action: auditLogs.action,
            entity: auditLogs.entity,
            entityId: auditLogs.entityId,
            meta: auditLogs.meta,
            createdAt: auditLogs.createdAt,
            userEmail: adminUsers.email,
        })
            .from(auditLogs)
            .leftJoin(adminUsers, eq(adminUsers.id, auditLogs.userId))
            .where(where)
            .orderBy(desc(auditLogs.createdAt))
            .limit(pageSize)
            .offset((page - 1) * pageSize),
        db.select({ value: count() }).from(auditLogs).where(where),
    ]);
    return { rows, total: totals[0]?.value ?? 0 };
};
//# sourceMappingURL=audit.repository.js.map