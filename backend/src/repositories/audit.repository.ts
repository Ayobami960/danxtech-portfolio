import { and, count, desc, eq, type SQL } from "drizzle-orm";
import { db } from "../db/client.js";
import { adminUsers, auditLogs } from "../database/schema.js";

export type AuditInput = {
  userId: string | null;
  action: string;
  entity: string;
  entityId: string | null;
  meta: Record<string, unknown> | null;
  ipHash: string | null;
  userAgent: string | null;
};

export const createAuditLog = async (input: AuditInput): Promise<void> => {
  await db.insert(auditLogs).values(input);
};

export const listAuditLogs = async (
  page: number,
  pageSize: number,
  entity?: string,
): Promise<{
  rows: Array<{
    id: string;
    action: string;
    entity: string;
    entityId: string | null;
    meta: Record<string, unknown> | null;
    createdAt: Date;
    userEmail: string | null;
  }>;
  total: number;
}> => {
  const where: SQL | undefined = entity
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
