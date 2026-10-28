import { and, count, desc, eq, inArray, ne, sql } from "drizzle-orm";
import { db } from "../../database/clients.js";
import { accounts, client_metadata, conversation_participants, conversations, freelancer_metadata, job_posts, message_attachments, messages, proposals, } from "../../database/schema.js";
import { ApiError } from "../../utils/api-error.js";
import { deleteDocuments, uploadDocuments } from "../../utils/upload-documents.js";
import { emitConversationUpdate } from "./messaging.events.js";
import { getAgencyIdForMember } from "../agency/agency.service.js";
const encodeCursor = (message) => Buffer.from(JSON.stringify([message.createdAt.toISOString(), message.id])).toString("base64url");
const decodeCursor = (cursor) => {
    try {
        const [createdAt, id] = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
        const date = new Date(createdAt);
        if (!id || Number.isNaN(date.getTime()))
            throw new Error();
        return { createdAt: date, id };
    }
    catch {
        throw new ApiError(400, "Message cursor is invalid.");
    }
};
export const requireMember = async (conversationId, userId) => {
    const [participant] = await db
        .select()
        .from(conversation_participants)
        .where(and(eq(conversation_participants.conversation_id, conversationId), eq(conversation_participants.account_id, userId)))
        .limit(1);
    if (participant)
        return participant;
    // Agency conversations have one shared participant row keyed by agency id,
    // not one row per team member. A freelancer keeps access to both their own
    // conversations and the conversations of the agency they belong to.
    const agencyId = await getAgencyIdForMember(userId);
    if (agencyId) {
        const [agencyParticipant] = await db
            .select()
            .from(conversation_participants)
            .where(and(eq(conversation_participants.conversation_id, conversationId), eq(conversation_participants.agency_id, agencyId)))
            .limit(1);
        if (agencyParticipant)
            return agencyParticipant;
    }
    throw new ApiError(404, "Conversation not found.");
};
const hydrateMessages = async (rows) => {
    if (!rows.length)
        return [];
    const attachments = await db
        .select()
        .from(message_attachments)
        .where(inArray(message_attachments.message_id, rows.map(({ id }) => id)));
    const replyIds = rows
        .map(({ replyToMessageId }) => replyToMessageId)
        .filter((id) => Boolean(id));
    const replies = replyIds.length
        ? await db
            .select({
            id: messages.id,
            senderId: messages.sender_id,
            messageType: messages.message_type,
            body: messages.body,
            eventType: messages.event_type,
        })
            .from(messages)
            .where(inArray(messages.id, replyIds))
        : [];
    return rows.map((message) => ({
        ...message,
        attachments: attachments.filter(({ message_id }) => message_id === message.id),
        replyTo: replies.find(({ id }) => id === message.replyToMessageId) ?? null,
    }));
};
const joinName = (first, last) => [first, last]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
const getParticipantProfiles = async (conversationIds) => {
    const profiles = new Map();
    if (!conversationIds.length)
        return profiles;
    const rows = await db
        .select({
        conversationId: conversation_participants.conversation_id,
        accountId: conversation_participants.account_id,
        participantType: conversation_participants.participant_type,
        role: accounts.role,
        accountFirstName: accounts.first_name,
        accountLastName: accounts.last_name,
        clientFirstName: client_metadata.first_name,
        clientLastName: client_metadata.last_name,
        companyName: client_metadata.company_name,
        professionalTitle: freelancer_metadata.professional_title,
        avatarUrl: sql `case
        when ${accounts.role} = 'FREELANCER' then nullif(${freelancer_metadata.avatar_url}, '')
        when ${accounts.role} = 'CLIENT' then nullif(${client_metadata.avatar_url}, '')
        else null
      end`,
    })
        .from(conversation_participants)
        .leftJoin(accounts, eq(conversation_participants.account_id, accounts.auth_id))
        .leftJoin(freelancer_metadata, eq(conversation_participants.account_id, freelancer_metadata.auth_id))
        .leftJoin(client_metadata, eq(conversation_participants.account_id, client_metadata.auth_id))
        .where(inArray(conversation_participants.conversation_id, conversationIds));
    for (const row of rows) {
        const profile = {
            accountId: row.accountId,
            participantType: row.participantType,
            role: row.role === "CLIENT"
                ? "client"
                : row.role === "FREELANCER"
                    ? "freelancer"
                    : null,
            name: joinName(row.accountFirstName, row.accountLastName) ||
                joinName(row.clientFirstName, row.clientLastName) ||
                row.companyName?.trim() ||
                "User",
            avatarUrl: row.avatarUrl ?? null,
            professionalTitle: row.professionalTitle ?? null,
            companyName: row.companyName ?? null,
        };
        const list = profiles.get(row.conversationId);
        if (list)
            list.push(profile);
        else
            profiles.set(row.conversationId, [profile]);
    }
    return profiles;
};
export const getConversations = async (userId, agencyId) => {
    const rows = await db
        .select({
        id: conversations.id,
        jobId: conversations.job_id,
        proposalId: conversations.proposal_id,
        lastMessageAt: conversations.last_message_at,
        updatedAt: conversations.updated_at,
        unreadCount: conversation_participants.unread_count,
        lastMessage: {
            id: messages.id,
            senderId: messages.sender_id,
            messageType: messages.message_type,
            body: messages.body,
            eventType: messages.event_type,
            createdAt: messages.created_at,
        },
        jobTitle: job_posts.title,
    })
        .from(conversation_participants)
        .innerJoin(conversations, eq(conversation_participants.conversation_id, conversations.id))
        .leftJoin(messages, eq(conversations.last_message_id, messages.id))
        .leftJoin(job_posts, eq(conversations.job_id, job_posts.id))
        .where(agencyId
        ? eq(conversation_participants.agency_id, agencyId)
        : eq(conversation_participants.account_id, userId))
        // Postgres puts NULLs first on DESC; keep empty conversations last.
        .orderBy(sql `${conversations.last_message_at} desc nulls last`, desc(conversations.created_at));
    const profiles = await getParticipantProfiles(rows.map(({ id }) => id));
    return {
        conversations: rows.map((row) => ({
            ...row,
            lastMessage: row.lastMessage?.id ? row.lastMessage : null,
            participants: profiles.get(row.id) ?? [],
            activeMeeting: null,
        })),
        totalUnread: rows.reduce((total, row) => total + row.unreadCount, 0),
    };
};
export const createConversation = async (clientId, input) => {
    let recipientId = input.recipientId;
    let jobId = input.jobId;
    let isAgencyConversation = false;
    let agencyIdForKey;
    if (input.proposalId) {
        const [proposal] = await db
            .select({
            freelancerId: proposals.sender_id,
            senderType: proposals.sender_type,
            jobId: proposals.job_id,
            clientId: job_posts.client_id,
        })
            .from(proposals)
            .innerJoin(job_posts, eq(proposals.job_id, job_posts.id))
            .where(eq(proposals.id, input.proposalId))
            .limit(1);
        if (!proposal || proposal.clientId !== clientId) {
            throw new ApiError(404, "Proposal not found.");
        }
        if (proposal.senderType === "AGENCY") {
            isAgencyConversation = true;
            agencyIdForKey = proposal.freelancerId;
        }
        else {
            recipientId = proposal.freelancerId;
        }
        jobId = proposal.jobId;
    }
    else {
        if (!recipientId)
            throw new ApiError(400, "Recipient is required.");
        const [recipient] = await db
            .select({ role: accounts.role })
            .from(accounts)
            .where(eq(accounts.auth_id, recipientId))
            .limit(1);
        if (recipient?.role !== "FREELANCER") {
            throw new ApiError(404, "Freelancer not found.");
        }
        if (jobId) {
            const [job] = await db
                .select({ id: job_posts.id })
                .from(job_posts)
                .where(and(eq(job_posts.id, jobId), eq(job_posts.client_id, clientId)))
                .limit(1);
            if (!job)
                throw new ApiError(404, "Job post not found.");
        }
    }
    const contextKey = isAgencyConversation
        ? `job:${jobId}:client:${clientId}:agency:${agencyIdForKey}`
        : jobId
            ? `job:${jobId}:client:${clientId}:talent:${recipientId}`
            : `direct:client:${clientId}:talent:${recipientId}`;
    const conversationId = await db.transaction(async (transaction) => {
        const [created] = await transaction
            .insert(conversations)
            .values({
            job_id: jobId,
            proposal_id: input.proposalId,
            context_key: contextKey,
        })
            .onConflictDoNothing({ target: conversations.context_key })
            .returning({ id: conversations.id });
        const existing = created ??
            (await transaction
                .select({ id: conversations.id })
                .from(conversations)
                .where(eq(conversations.context_key, contextKey))
                .limit(1))[0];
        if (!existing) {
            throw new ApiError(500, "Conversation could not be created.");
        }
        await transaction
            .insert(conversation_participants)
            .values([
            {
                conversation_id: existing.id,
                account_id: clientId,
                participant_type: "CLIENT",
            },
            isAgencyConversation
                ? {
                    conversation_id: existing.id,
                    agency_id: agencyIdForKey,
                    participant_type: "AGENCY",
                }
                : {
                    conversation_id: existing.id,
                    account_id: recipientId,
                    participant_type: "FREELANCER",
                },
        ])
            .onConflictDoNothing();
        return existing.id;
    });
    const data = await getConversations(clientId);
    const conversation = data.conversations.find(({ id }) => id === conversationId);
    if (!conversation) {
        throw new ApiError(500, "Conversation could not be loaded.");
    }
    return conversation;
};
export const sendMessage = async (conversationId, senderId, input) => {
    const participant = await requireMember(conversationId, senderId);
    if (input.replyToMessageId) {
        const [reply] = await db
            .select({ id: messages.id })
            .from(messages)
            .where(and(eq(messages.id, input.replyToMessageId), eq(messages.conversation_id, conversationId)))
            .limit(1);
        if (!reply)
            throw new ApiError(400, "Reply message is invalid.");
    }
    const { documents: uploaded, uploadedIds } = await uploadDocuments(`/onemarketplace/messages/${conversationId}/${senderId}`, input.attachments);
    let message;
    try {
        message = await db.transaction(async (transaction) => {
            const [created] = await transaction
                .insert(messages)
                .values({
                conversation_id: conversationId,
                sender_id: senderId,
                body: input.body ?? null,
                reply_to_message_id: input.replyToMessageId ?? null,
            })
                .returning();
            if (!created)
                throw new ApiError(500, "Message could not be sent.");
            if (uploaded.length) {
                await transaction.insert(message_attachments).values(uploaded.map((attachment) => ({
                    message_id: created.id,
                    storage_key: attachment.fileId,
                    file_url: attachment.fileUrl,
                    file_name: attachment.fileName,
                    mime_type: attachment.mimeType,
                    file_size: attachment.fileSize,
                    attachment_type: attachment.attachmentType,
                })));
            }
            await transaction
                .update(conversations)
                .set({
                last_message_id: created.id,
                last_message_at: created.created_at,
                updated_at: new Date(),
            })
                .where(eq(conversations.id, conversationId));
            await transaction
                .update(conversation_participants)
                .set({
                unread_count: sql `${conversation_participants.unread_count} + 1`,
            })
                .where(and(eq(conversation_participants.conversation_id, conversationId), ne(conversation_participants.id, participant.id)));
            return created;
        });
    }
    catch (error) {
        await deleteDocuments(uploadedIds);
        throw error;
    }
    const hydrated = (await hydrateMessages([
        {
            id: message.id,
            conversationId: message.conversation_id,
            senderId: message.sender_id,
            messageType: message.message_type,
            body: message.body,
            eventType: message.event_type,
            eventPayload: message.event_payload,
            replyToMessageId: message.reply_to_message_id,
            createdAt: message.created_at,
        },
    ]))[0];
    // The transaction has committed; publish only now so no listener can fetch
    // a thread before the message exists.
    await emitConversationUpdate(conversationId, {
        messagesChanged: true,
        senderId,
    }).catch((error) => {
        console.error("Failed to emit conversation update.", error);
    });
    return hydrated;
};
export const getMessages = async (conversationId, userId, cursor, limit = 30) => {
    await requireMember(conversationId, userId);
    const before = cursor ? decodeCursor(cursor) : null;
    const rows = await db
        .select({
        id: messages.id,
        conversationId: messages.conversation_id,
        senderId: messages.sender_id,
        messageType: messages.message_type,
        body: messages.body,
        eventType: messages.event_type,
        eventPayload: messages.event_payload,
        replyToMessageId: messages.reply_to_message_id,
        createdAt: messages.created_at,
    })
        .from(messages)
        .where(and(eq(messages.conversation_id, conversationId), before
        ? sql `(${messages.created_at}, ${messages.id}) < (
              SELECT cursor_message.created_at, cursor_message.id
              FROM ${messages} AS cursor_message
              WHERE cursor_message.id = ${before.id}
                AND cursor_message.conversation_id = ${conversationId}
            )`
        : undefined))
        .orderBy(desc(messages.created_at), desc(messages.id))
        .limit(limit + 1);
    const hasMore = rows.length > limit;
    const page = rows.slice(0, limit);
    const oldest = page.at(-1);
    return {
        messages: (await hydrateMessages(page)).reverse(),
        nextCursor: hasMore && oldest ? encodeCursor(oldest) : null,
    };
};
export const postSystemEventMessage = async (conversationId, event, options = {}) => {
    let excludeParticipantId;
    if (options.actorId) {
        const participant = await requireMember(conversationId, options.actorId);
        excludeParticipantId = participant.id;
    }
    const message = await db.transaction(async (transaction) => {
        const [created] = await transaction
            .insert(messages)
            .values({
            conversation_id: conversationId,
            sender_id: options.actorId,
            message_type: "SYSTEM_EVENT",
            event_type: event.eventType,
            event_payload: event.eventPayload,
        })
            .returning();
        if (!created) {
            throw new ApiError(500, "Event message could not be created.");
        }
        await transaction
            .update(conversations)
            .set({
            last_message_id: created.id,
            last_message_at: created.created_at,
            updated_at: new Date(),
        })
            .where(eq(conversations.id, conversationId));
        await transaction
            .update(conversation_participants)
            .set({
            unread_count: sql `${conversation_participants.unread_count} + 1`,
        })
            .where(excludeParticipantId
            ? and(eq(conversation_participants.conversation_id, conversationId), ne(conversation_participants.id, excludeParticipantId))
            : eq(conversation_participants.conversation_id, conversationId));
        return created;
    });
    const hydrated = (await hydrateMessages([
        {
            id: message.id,
            conversationId: message.conversation_id,
            senderId: message.sender_id,
            messageType: message.message_type,
            body: message.body,
            eventType: message.event_type,
            eventPayload: message.event_payload,
            replyToMessageId: message.reply_to_message_id,
            createdAt: message.created_at,
        },
    ]))[0];
    // The transaction has committed; a socket failure must not make the caller
    // think the event message was not posted.
    await emitConversationUpdate(conversationId, {
        messagesChanged: true,
        senderId: options.actorId ?? null,
    }).catch((error) => {
        console.error("Failed to emit conversation update.", error);
    });
    return hydrated;
};
export const markConversationRead = async (conversationId, userId, lastReadMessageId) => {
    const participant = await requireMember(conversationId, userId);
    const [message] = await db
        .select({ id: messages.id, createdAt: messages.created_at })
        .from(messages)
        .where(and(eq(messages.id, lastReadMessageId), eq(messages.conversation_id, conversationId)))
        .limit(1);
    if (!message)
        throw new ApiError(400, "Read message is invalid.");
    const [remaining] = await db
        .select({ value: count(messages.id) })
        .from(messages)
        .where(and(eq(messages.conversation_id, conversationId), ne(messages.sender_id, userId), 
    // Compare both columns in Postgres. Round-tripping the boundary
    // through a JS Date drops microseconds, which made the message being
    // read count as unread.
    sql `(${messages.created_at}, ${messages.id}) > (
          SELECT target_message.created_at, target_message.id
          FROM ${messages} AS target_message
          WHERE target_message.id = ${message.id}
            AND target_message.conversation_id = ${conversationId}
        )`));
    const [updated] = await db
        .update(conversation_participants)
        .set({
        last_read_message_id: message.id,
        last_read_at: new Date(),
        unread_count: remaining?.value ?? 0,
    })
        .where(and(eq(conversation_participants.id, participant.id), sql `(
          ${conversation_participants.last_read_message_id} IS NULL
          OR NOT EXISTS (
            SELECT 1
            FROM ${messages} AS current_read_message
            JOIN ${messages} AS target_message ON target_message.id = ${message.id}
            WHERE current_read_message.id = ${conversation_participants.last_read_message_id}
              AND (current_read_message.created_at, current_read_message.id)
                  >= (target_message.created_at, target_message.id)
          )
        )`))
        .returning({ unreadCount: conversation_participants.unread_count });
    if (updated) {
        return { conversationId, lastReadMessageId: message.id, ...updated };
    }
    const [current] = await db
        .select({
        lastReadMessageId: conversation_participants.last_read_message_id,
        unreadCount: conversation_participants.unread_count,
    })
        .from(conversation_participants)
        .where(eq(conversation_participants.id, participant.id))
        .limit(1);
    return { conversationId, ...current };
};
//# sourceMappingURL=messaging.service.js.map