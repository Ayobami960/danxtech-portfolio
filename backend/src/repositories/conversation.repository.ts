import {
  and,
  count,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNull,
  lt,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { db } from "../db/client.js";
import {
  chatMessages,
  conversations,
  type Conversation,
} from "../database/schema.js";

export type ConversationFilters = {
  status?: "new" | "open" | "closed" | "archived";
  starred?: boolean;
  isSpam?: boolean;
  unread?: boolean;
  q?: string;
};

const escapeLike = (value: string): string =>
  value.replace(/[\\%_]/g, (character) => `\\${character}`);

const buildFilters = (filters: ConversationFilters): SQL | undefined => {
  const conditions: SQL[] = [];
  if (filters.status) conditions.push(eq(conversations.status, filters.status));
  if (filters.starred !== undefined) {
    conditions.push(eq(conversations.starred, filters.starred));
  }
  if (filters.isSpam !== undefined) {
    conditions.push(eq(conversations.isSpam, filters.isSpam));
  }
  if (filters.unread) conditions.push(gt(conversations.unreadForAdmin, 0));
  if (filters.q) {
    const pattern = `%${escapeLike(filters.q)}%`;
    const search = or(
      ilike(conversations.visitorName, pattern),
      ilike(conversations.visitorEmail, pattern),
      ilike(conversations.subject, pattern),
      ilike(conversations.lastMessagePreview, pattern),
    );
    if (search) conditions.push(search);
  }
  return conditions.length > 0 ? and(...conditions) : undefined;
};

export const createConversation = async (
  input: Omit<Conversation, "id" | "createdAt" | "updatedAt">,
): Promise<Conversation> => {
  const rows = await db.insert(conversations).values(input).returning();
  const created = rows[0];
  if (!created) throw new Error("Failed to create the conversation.");
  return created;
};

export const listConversations = async (
  filters: ConversationFilters,
  page: number,
  pageSize: number,
): Promise<{ rows: Conversation[]; total: number }> => {
  const where = buildFilters(filters);
  const [rows, totals] = await Promise.all([
    db
      .select()
      .from(conversations)
      .where(where)
      .orderBy(desc(conversations.lastMessageAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ value: count() }).from(conversations).where(where),
  ]);
  return { rows, total: totals[0]?.value ?? 0 };
};

export const findConversationById = async (
  id: string,
): Promise<Conversation | null> => {
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, id))
    .limit(1);
  return rows[0] ?? null;
};

export const findConversationByInviteHash = async (
  hash: string,
): Promise<Conversation | null> => {
  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.inviteTokenHash, hash))
    .limit(1);
  return rows[0] ?? null;
};

export const updateConversation = async (
  id: string,
  input: Partial<Omit<Conversation, "id" | "createdAt" | "updatedAt">>,
): Promise<Conversation | null> => {
  const rows = await db
    .update(conversations)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(conversations.id, id))
    .returning();
  return rows[0] ?? null;
};

export const deleteConversation = async (id: string): Promise<void> => {
  await db.delete(conversations).where(eq(conversations.id, id));
};

export const countUnreadConversations = async (): Promise<number> => {
  const rows = await db
    .select({ value: count() })
    .from(conversations)
    .where(
      and(eq(conversations.isSpam, false), gt(conversations.unreadForAdmin, 0)),
    );
  return rows[0]?.value ?? 0;
};

export const countOpenConversations = async (): Promise<number> => {
  const rows = await db
    .select({ value: count() })
    .from(conversations)
    .where(inArray(conversations.status, ["new", "open"]));
  return rows[0]?.value ?? 0;
};

export const countConversations = async (): Promise<number> => {
  const rows = await db.select({ value: count() }).from(conversations);
  return rows[0]?.value ?? 0;
};

export const incrementUnread = async (
  id: string,
  side: "admin" | "visitor",
): Promise<void> => {
  await db
    .update(conversations)
    .set(
      side === "admin"
        ? { unreadForAdmin: sql`${conversations.unreadForAdmin} + 1` }
        : { unreadForVisitor: sql`${conversations.unreadForVisitor} + 1` },
    )
    .where(eq(conversations.id, id));
};

export const resetUnread = async (
  id: string,
  side: "admin" | "visitor",
  seenAt: Date,
): Promise<void> => {
  await db
    .update(conversations)
    .set(
      side === "admin"
        ? { unreadForAdmin: 0, adminLastSeenAt: seenAt }
        : { unreadForVisitor: 0, visitorLastSeenAt: seenAt },
    )
    .where(eq(conversations.id, id));
};

export const touchConversation = async (
  id: string,
  preview: string,
  at: Date,
): Promise<void> => {
  await db
    .update(conversations)
    .set({
      lastMessagePreview: preview.slice(0, 160),
      lastMessageAt: at,
      ...(await statusAfterMessage(id)),
    })
    .where(eq(conversations.id, id));
};

/** A reply moves a `new` conversation to `open`; closed stays closed. */
const statusAfterMessage = async (
  id: string,
): Promise<{ status?: "open" }> => {
  const current = await findConversationById(id);
  return current && current.status === "new" ? { status: "open" } : {};
};

export const closeIdleConversations = async (
  idleDays: number,
): Promise<number> => {
  const cutoff = new Date(Date.now() - idleDays * 24 * 60 * 60 * 1000);
  const rows = await db
    .update(conversations)
    .set({ status: "closed", closedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        inArray(conversations.status, ["new", "open"]),
        lt(conversations.lastMessageAt, cutoff),
      ),
    )
    .returning({ id: conversations.id });
  return rows.length;
};

export const deleteClosedConversations = async (
  olderThanDays: number,
): Promise<number> => {
  const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  const rows = await db
    .delete(conversations)
    .where(
      and(
        eq(conversations.status, "closed"),
        lt(conversations.closedAt, cutoff),
      ),
    )
    .returning({ id: conversations.id });
  return rows.length;
};

export const countRecentMessages = async (
  conversationId: string,
  sender: "visitor" | "admin",
  since: Date,
): Promise<number> => {
  const rows = await db
    .select({ value: count() })
    .from(chatMessages)
    .where(
      and(
        eq(chatMessages.conversationId, conversationId),
        eq(chatMessages.sender, sender),
        gt(chatMessages.createdAt, since),
      ),
    );
  return rows[0]?.value ?? 0;
};

export const latestMessageAt = async (): Promise<Date | null> => {
  const rows = await db
    .select({ value: chatMessages.createdAt })
    .from(chatMessages)
    .orderBy(desc(chatMessages.createdAt))
    .limit(1);
  return rows[0]?.value ?? null;
};

export const conversationsWithLiveInvite = async (): Promise<
  Array<{ id: string; inviteExpiresAt: Date | null }>
> =>
  db
    .select({
      id: conversations.id,
      inviteExpiresAt: conversations.inviteExpiresAt,
    })
    .from(conversations)
    .where(
      and(
        isNull(conversations.inviteRevokedAt),
        gt(conversations.inviteExpiresAt, new Date()),
      ),
    );
