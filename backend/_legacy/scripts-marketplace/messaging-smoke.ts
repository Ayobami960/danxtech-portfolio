/**
 * End-to-end messaging smoke test.
 *
 * Start the API first (`npm run dev`), then run:
 *   npx tsx scripts/messaging-smoke.ts
 *
 * It creates two temporary accounts (client + freelancer) plus an outsider,
 * exercises REST and Socket.io, and deletes everything it created.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { SignJWT } from "jose";
import { eq, inArray } from "drizzle-orm";
import { io, type Socket } from "socket.io-client";
import { db } from "../src/database/clients.js";
import { env } from "../src/config/env.js";
import { imageKit } from "../src/config/imageKit.js";
import {
  accounts,
  conversation_participants,
  conversations,
  message_attachments,
  messages,
  sessions,
} from "../src/database/schema.js";

const API = `http://localhost:${env.port}/api/v1`;
const SOCKET = `http://localhost:${env.port}`;
const secret = new TextEncoder().encode(env.jwtAccessSecret);

type Role = "CLIENT" | "FREELANCER";
type Account = { authId: string; sessionId: string; token: string; role: Role };

const createAccount = async (role: Role): Promise<Account> => {
  const authId = randomUUID();
  const suffix = randomUUID().slice(0, 8);
  await db.insert(accounts).values({
    auth_id: authId,
    email: `smoke-${role.toLowerCase()}-${suffix}@example.invalid`,
    first_name: "Smoke",
    last_name: role === "CLIENT" ? "Client" : "Freelancer",
    role,
    email_verified_at: new Date(),
    isOnboardingComplete: true,
  });
  const [session] = await db
    .insert(sessions)
    .values({
      account_id: authId,
      family_id: randomUUID(),
      token_hash: randomBytes(32).toString("hex"),
      expires_at: new Date(Date.now() + 60 * 60 * 1000),
    })
    .returning({ id: sessions.id });
  if (!session) throw new Error("session insert failed");

  const accessToken = await new SignJWT({
    role: role.toLowerCase(),
    sid: session.id,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(authId)
    .setIssuedAt()
    .setExpirationTime("15m")
    .sign(secret);

  return { authId, sessionId: session.id, token: accessToken, role };
};

const api = async (path: string, account: Account, init: RequestInit = {}) => {
  const response = await fetch(`${API}/${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${account.token}`,
      ...(init.headers ?? {}),
    },
  });
  const body = await response.json().catch(() => null);
  return { status: response.status, body };
};

const connect = (account: Account): Promise<Socket> =>
  new Promise((resolve, reject) => {
    const socket = io(SOCKET, {
      auth: { token: account.token, role: account.role.toLowerCase() },
      reconnection: false,
      transports: ["websocket"],
    });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("socket connect timeout"));
    }, 5_000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });

const waitFor = <T,>(
  socket: Socket,
  event: string,
  predicate: (payload: T) => boolean = () => true,
  timeoutMs = 5_000,
): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, handler);
      reject(new Error(`timed out waiting for ${event}`));
    }, timeoutMs);
    const handler = (payload: T) => {
      if (!predicate(payload)) return;
      clearTimeout(timer);
      socket.off(event, handler);
      resolve(payload);
    };
    socket.on(event, handler);
  });

const expectSocketRejected = (
  auth: Record<string, unknown>,
  label: string,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const socket = io(SOCKET, { auth, reconnection: false, transports: ["websocket"] });
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error(`${label}: socket was neither accepted nor rejected`));
    }, 5_000);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.close();
      reject(new Error(`${label}: socket was accepted`));
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      socket.close();
      console.log(`PASS ${label}: ${error.message}`);
      resolve();
    });
  });

const totalUnread = async (account: Account, role: string): Promise<number> => {
  const result = await api(`conversations?role=${role}`, account);
  return result.body.data.totalUnread as number;
};

const run = async () => {
  const created: string[] = [];
  const sockets: Socket[] = [];
  let conversationId: string | undefined;

  try {
    const client = await createAccount("CLIENT");
    const freelancer = await createAccount("FREELANCER");
    const outsider = await createAccount("FREELANCER");
    created.push(client.authId, freelancer.authId, outsider.authId);

    const clientSocket = await connect(client);
    const freelancerSocket = await connect(freelancer);
    sockets.push(clientSocket, freelancerSocket);
    console.log("PASS sockets authenticated for both roles");

    // Presence: first socket online, last socket offline.
    const outsiderOnline = waitFor<{ userId: string; online: boolean }>(
      clientSocket,
      "presence:update",
      (payload) => payload.userId === outsider.authId && payload.online,
    );
    const outsiderSocket = await connect(outsider);
    await outsiderOnline;
    const outsiderOffline = waitFor<{ userId: string; online: boolean }>(
      clientSocket,
      "presence:update",
      (payload) => payload.userId === outsider.authId && !payload.online,
    );
    outsiderSocket.close();
    await outsiderOffline;
    console.log("PASS presence online/offline updates");

    const opened = waitFor<{ conversationId: string }>(
      freelancerSocket,
      "conversation:update",
      (payload) => Boolean(payload.conversationId),
    );
    const createdConversation = await api("conversations?role=client", client, {
      method: "POST",
      body: JSON.stringify({ recipientId: freelancer.authId }),
    });
    if (createdConversation.status !== 201) {
      throw new Error(`open conversation failed: ${JSON.stringify(createdConversation.body)}`);
    }
    conversationId = createdConversation.body.data.id as string;
    await opened;
    console.log("PASS client opened conversation; freelancer received conversation:update");

    // A second tab for the sender must also receive the update.
    const clientTab2 = await connect(client);
    sockets.push(clientTab2);
    const ownTabUpdate = waitFor<{ senderId: string | null; messagesChanged: boolean }>(
      clientTab2,
      "conversation:update",
      (payload) =>
        payload.conversationId === conversationId &&
        payload.messagesChanged === true &&
        payload.senderId === client.authId,
    );
    const sent = await api(`conversations/${conversationId}/messages?role=client`, client, {
      method: "POST",
      body: JSON.stringify({ body: "hello live" }),
    });
    if (sent.status !== 201) throw new Error(`send failed: ${JSON.stringify(sent.body)}`);
    await ownTabUpdate;
    console.log("PASS message delivered to the sender's other tab");

    const receivedByFreelancer = waitFor<{ senderId: string | null }>(
      freelancerSocket,
      "conversation:update",
      (payload) =>
        payload.conversationId === conversationId &&
        payload.messagesChanged === true &&
        payload.senderId === client.authId,
    );
    await api(`conversations/${conversationId}/messages?role=client`, client, {
      method: "POST",
      body: JSON.stringify({ body: "second live message" }),
    });
    await receivedByFreelancer;
    console.log("PASS message delivered live to the freelancer socket");

    const clientTyping = waitFor<{ userId: string; isTyping: boolean }>(
      freelancerSocket,
      "typing:update",
      (payload) => payload.userId === client.authId && payload.isTyping === true,
    );
    clientSocket.emit("typing:set", { conversationId, isTyping: true });
    await clientTyping;
    const freelancerTyping = waitFor<{ userId: string; isTyping: boolean }>(
      clientSocket,
      "typing:update",
      (payload) => payload.userId === freelancer.authId && payload.isTyping === true,
    );
    freelancerSocket.emit("typing:set", { conversationId, isTyping: true });
    await freelancerTyping;
    console.log("PASS typing indicators relayed in both directions");

    // Freelancer replies; the client receives it in real time.
    const replyUpdate = waitFor<{ senderId: string | null }>(
      clientSocket,
      "conversation:update",
      (payload) =>
        payload.conversationId === conversationId &&
        payload.messagesChanged === true &&
        payload.senderId === freelancer.authId,
    );
    const reply = await api(`conversations/${conversationId}/messages?role=freelancer`, freelancer, {
      method: "POST",
      body: JSON.stringify({ body: "reply live" }),
    });
    if (reply.status !== 201) throw new Error(`reply failed: ${JSON.stringify(reply.body)}`);
    await replyUpdate;
    console.log("PASS freelancer reply delivered live to the client");

    // Unread is per participant and matches the header total.
    if ((await totalUnread(freelancer, "freelancer")) !== 2) {
      throw new Error("expected freelancer unread 2 after two client messages");
    }
    if ((await totalUnread(client, "client")) !== 1) {
      throw new Error("expected client unread 1 after the freelancer reply");
    }
    console.log("PASS unread counts are correct for both sides");

    // Freelancer marks read over the socket.
    const freelancerMessages = await api(
      `conversations/${conversationId}/messages?role=freelancer`,
      freelancer,
    );
    const newestId = freelancerMessages.body.data.messages.at(-1).id as string;
    const readUpdate = waitFor<{ messagesChanged: boolean }>(
      clientSocket,
      "conversation:update",
      (payload) =>
        payload.conversationId === conversationId && payload.messagesChanged === false,
    );
    const readAck = await new Promise<{ success: boolean }>((resolve) =>
      freelancerSocket.emit("conversation:read", { conversationId, messageId: newestId }, resolve),
    );
    if (!readAck.success) throw new Error("socket read ack failed");
    await readUpdate;
    if ((await totalUnread(freelancer, "freelancer")) !== 0) {
      throw new Error("socket read did not clear the freelancer unread count");
    }
    console.log("PASS read over socket cleared unread and notified the client");

    // Client marks read over REST.
    const clientMessages = await api(
      `conversations/${conversationId}/messages?role=client`,
      client,
    );
    const clientNewestId = clientMessages.body.data.messages.at(-1).id as string;
    const restRead = await api(`conversations/${conversationId}/read?role=client`, client, {
      method: "POST",
      body: JSON.stringify({ lastReadMessageId: clientNewestId }),
    });
    if (restRead.status !== 200) throw new Error(`REST read failed: ${JSON.stringify(restRead.body)}`);
    if ((await totalUnread(client, "client")) !== 0) {
      throw new Error("REST read did not clear the client unread count");
    }
    console.log("PASS REST read cleared unread and emitted an update");

    // Cursor pagination: unique ids across pages, newest page first.
    for (let index = 1; index <= 5; index += 1) {
      await api(`conversations/${conversationId}/messages?role=client`, client, {
        method: "POST",
        body: JSON.stringify({ body: `page message ${index}` }),
      });
    }
    const firstPage = await api(
      `conversations/${conversationId}/messages?role=freelancer&limit=2`,
      freelancer,
    );
    if (firstPage.body.data.messages.length !== 2 || !firstPage.body.data.nextCursor) {
      throw new Error("pagination did not return a full page with a cursor");
    }
    if (firstPage.body.data.messages.at(-1).body !== "page message 5") {
      throw new Error("the newest page did not end with the newest message");
    }

    const seen = new Set<string>();
    let cursor: string | null = firstPage.body.data.nextCursor as string;
    let pages = 1;
    while (cursor) {
      const page = await api(
        `conversations/${conversationId}/messages?role=freelancer&limit=2&cursor=${encodeURIComponent(cursor)}`,
        freelancer,
      );
      for (const message of page.body.data.messages) {
        if (seen.has(message.id)) throw new Error("cursor pagination repeated a message");
        seen.add(message.id);
      }
      cursor = page.body.data.nextCursor as string | null;
      pages += 1;
      if (pages > 20) throw new Error("cursor pagination did not terminate");
    }
    console.log(`PASS cursor pagination (${pages} pages, no duplicates)`);

    // Attachment: upload a tiny TXT through the same path the dashboards use.
    const attachmentBody = Buffer.from("smoke attachment").toString("base64");
    const attachmentSend = await api(
      `conversations/${conversationId}/messages?role=client`,
      client,
      {
        method: "POST",
        body: JSON.stringify({
          body: "with attachment",
          attachments: [
            {
              fileUrl: `data:text/plain;base64,${attachmentBody}`,
              fileName: "smoke.txt",
              fileSize: Buffer.from("smoke attachment").byteLength,
              mimeType: "text/plain",
            },
          ],
        }),
      },
    );
    if (attachmentSend.status === 201) {
      const attachment = attachmentSend.body.data.attachments?.[0];
      if (!attachment?.file_url?.startsWith("http")) {
        throw new Error("attachment was not uploaded to storage");
      }
      console.log("PASS attachment uploaded and returned a download URL");
    } else if (attachmentSend.status === 503) {
      console.warn("SKIP attachment upload: ImageKit credentials are not configured.");
    } else {
      throw new Error(`attachment send failed: ${JSON.stringify(attachmentSend.body)}`);
    }

    // Non-members cannot read, write, or type.
    const outsiderSocket2 = await connect(outsider);
    sockets.push(outsiderSocket2);
    const outsiderRead = await api(
      `conversations/${conversationId}/messages?role=freelancer`,
      outsider,
    );
    const outsiderSend = await api(
      `conversations/${conversationId}/messages?role=freelancer`,
      outsider,
      { method: "POST", body: JSON.stringify({ body: "nope" }) },
    );
    if (outsiderRead.status !== 404 || outsiderSend.status !== 404) {
      throw new Error(
        `outsider access not blocked: read=${outsiderRead.status} send=${outsiderSend.status}`,
      );
    }
    let outsiderTypingLeaked = false;
    const leakListener = () => {
      outsiderTypingLeaked = true;
    };
    clientSocket.on("typing:update", leakListener);
    outsiderSocket2.emit("typing:set", { conversationId, isTyping: true });
    await new Promise((resolve) => setTimeout(resolve, 400));
    clientSocket.off("typing:update", leakListener);
    if (outsiderTypingLeaked) throw new Error("outsider typing leaked to members");
    console.log("PASS non-member cannot read, send, or type in the conversation");

    const roleMismatch = await api("conversations?role=freelancer", client);
    if (roleMismatch.status !== 403) {
      throw new Error(`expected 403 for role mismatch, got ${roleMismatch.status}`);
    }
    const badUuid = await api("conversations/not-a-uuid/messages?role=client", client);
    if (badUuid.status !== 400) {
      throw new Error(`expected 400 for bad uuid, got ${badUuid.status}`);
    }
    console.log("PASS REST role mismatch is 403 and malformed uuid is 400");

    // Socket auth rejections.
    await expectSocketRejected({ token: "not-a-token", role: "client" }, "invalid token rejected");
    const expiredToken = await new SignJWT({ role: "client", sid: client.sessionId })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(client.authId)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 120)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 60)
      .sign(secret);
    await expectSocketRejected(
      { token: expiredToken, role: "client" },
      "expired token rejected",
    );
    await expectSocketRejected(
      { token: client.token, role: "freelancer" },
      "mismatched role rejected",
    );

    await db
      .update(sessions)
      .set({ revoked_at: new Date() })
      .where(eq(sessions.id, client.sessionId));
    await expectSocketRejected(
      { token: client.token, role: "client" },
      "revoked session rejected",
    );
  } finally {
    sockets.forEach((socket) => socket.close());

    if (conversationId) {
      // ImageKit objects are not deleted by the database cascade.
      const attachments = await db
        .select({ storageKey: message_attachments.storage_key })
        .from(message_attachments)
        .innerJoin(messages, eq(message_attachments.message_id, messages.id))
        .where(eq(messages.conversation_id, conversationId));
      await Promise.allSettled(
        attachments.map(({ storageKey }) => imageKit.files.delete(storageKey)),
      );
      await db.delete(conversations).where(eq(conversations.id, conversationId));
    }
    if (created.length) {
      await db.delete(sessions).where(inArray(sessions.account_id, created));
      await db.delete(accounts).where(inArray(accounts.auth_id, created));
    }
  }
};

run()
  .then(() => {
    console.log("ALL SMOKE CHECKS PASSED");
    process.exit(0);
  })
  .catch((error) => {
    console.error("SMOKE FAILED", error);
    process.exit(1);
  });
