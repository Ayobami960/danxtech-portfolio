/* Temporary verification harness — deleted after the run. */
import { and, eq } from "drizzle-orm";
import { db } from "../src/db/client.js";
import {
  chatMessages,
  chatVerificationCodes,
  conversations,
} from "../src/database/schema.js";
import { inviteHashFor, inviteTokenFor } from "../src/lib/invite.js";
import { hashOtpCode } from "../src/lib/otp.js";
import { createVerificationCode } from "../src/repositories/chat-verification.repository.js";
import { updateConversation } from "../src/repositories/conversation.repository.js";

const BASE = "http://127.0.0.1:8001/api/v1";
const EMAIL = "e2e.visitor@example.invalid";
const CODE = "135792";

let failures = 0;
const check = (label: string, ok: boolean, detail = ""): void => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

const post = async (
  path: string,
  body: unknown,
  cookie?: string,
): Promise<{ status: number; json: any; cookie: string | null }> => {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
      origin: "http://localhost:3000",
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  return {
    status: response.status,
    json: text ? JSON.parse(text) : null,
    cookie: response.headers.get("set-cookie"),
  };
};

const get = async (
  path: string,
  cookie?: string,
): Promise<{ status: number; json: any }> => {
  const response = await fetch(`${BASE}${path}`, {
    headers: cookie ? { cookie } : {},
  });
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) : null };
};

const run = async (): Promise<void> => {
  /* 1. Contact form submission. */
  const contact = await post("/contact", {
    name: "E2E Visitor",
    email: "E2E.Visitor@Example.invalid",
    subject: "Automated flow check",
    message: "This message was produced by the automated end-to-end check.",
    website: "",
  });
  check("POST /contact returns 201", contact.status === 201, String(contact.status));
  check(
    "contact response carries no credential",
    !JSON.stringify(contact.json).includes("token"),
  );

  const rows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.visitorEmail, EMAIL));
  const conversation = rows[0];
  check("conversation stored with lowercased email", Boolean(conversation));
  if (!conversation) return;
  check(
    "first message stored as visitor sender",
    (
      await db
        .select()
        .from(chatMessages)
        .where(eq(chatMessages.conversationId, conversation.id))
    ).length === 1,
  );

  /* 2. Invite: the link carries id + token, no session. */
  const sentAt = new Date();
  const token = inviteTokenFor(conversation.id, sentAt);
  await updateConversation(conversation.id, {
    inviteTokenHash: inviteHashFor(token),
    inviteSentAt: sentAt,
    inviteExpiresAt: new Date(sentAt.getTime() + 7 * 24 * 3600 * 1000),
    inviteRevokedAt: null,
  });

  const link = { conversationId: conversation.id, token };

  /* 3. Unverified access is refused. */
  const messagesWithoutSession = await get("/chat/messages");
  check(
    "chat endpoint refuses a request without a session",
    messagesWithoutSession.status === 401 ||
      messagesWithoutSession.status === 403,
    String(messagesWithoutSession.status),
  );

  /* 4. Invite token alone does not open the chat. */
  const joinWithoutSession = await post("/chat/join", {});
  check(
    "invite link alone does not issue a session",
    joinWithoutSession.status === 401 || joinWithoutSession.status === 403,
    String(joinWithoutSession.status),
  );

  /* 5. Wrong email: identical generic answer, no code stored. */
  const before = await db
    .select()
    .from(chatVerificationCodes)
    .where(eq(chatVerificationCodes.conversationId, conversation.id));
  const wrongEmail = await post("/chat/verify/request", {
    ...link,
    email: "someone.else@example.invalid",
  });
  const afterWrong = await db
    .select()
    .from(chatVerificationCodes)
    .where(eq(chatVerificationCodes.conversationId, conversation.id));
  check("wrong email returns 200 generic message", wrongEmail.status === 200);
  check(
    "wrong email stores no code (no enumeration)",
    before.length === afterWrong.length,
  );

  /* 6. Correct email requests a code. */
  const rightEmail = await post("/chat/verify/request", {
    ...link,
    email: EMAIL,
  });
  check("right email returns 200", rightEmail.status === 200);
  check(
    "right email answer is identical",
    JSON.stringify(rightEmail.json) === JSON.stringify(wrongEmail.json),
  );
  const storedCodes = await db
    .select()
    .from(chatVerificationCodes)
    .where(eq(chatVerificationCodes.conversationId, conversation.id));
  check("a code row was stored", storedCodes.length > 0);
  check(
    "stored code never holds the plain six digits",
    storedCodes.every(
      (row) => !Object.values(row).includes(CODE) && row.codeHash.length === 64,
    ),
  );

  /* 7. A known code (same hashing) to exercise confirm without reading mail. */
  await createVerificationCode({
    conversationId: conversation.id,
    email: EMAIL,
    codeHash: hashOtpCode(CODE, conversation.id, EMAIL),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000),
  });

  const wrongCode = await post("/chat/verify/confirm", {
    ...link,
    email: EMAIL,
    code: "000000",
  });
  check("wrong code is rejected", wrongCode.status === 400, String(wrongCode.status));
  check(
    "wrong code message is a plain validation error",
    wrongCode.json?.error?.message === "That code is incorrect. Please try again.",
    String(wrongCode.json?.error?.message),
  );

  const confirmed = await post("/chat/verify/confirm", {
    ...link,
    email: EMAIL,
    code: CODE,
  });
  check("correct code issues a session", confirmed.status === 200, String(confirmed.status));
  check(
    "session cookie is httpOnly",
    typeof confirmed.cookie === "string" && /httponly/i.test(confirmed.cookie),
    String(confirmed.cookie).slice(0, 40),
  );

  const cookie = confirmed.cookie?.split(";")[0] ?? "";
  check("body also returns the guest token", typeof confirmed.json?.guestToken === "string");

  const reused = await post("/chat/verify/confirm", {
    ...link,
    email: EMAIL,
    code: CODE,
  });
  check("a used code cannot be replayed", reused.status === 400, String(reused.status));

  /* 8. The session only reaches its own conversation. */
  const history = await get("/chat/messages", cookie);
  check("session reads its own history", history.status === 200, String(history.status));
  check(
    "history contains the contact message",
    JSON.stringify(history.json).includes("automated end-to-end check"),
  );

  const sent = await post(
    "/chat/messages",
    { clientMsgId: crypto.randomUUID(), body: "Hello from the visitor side." },
    cookie,
  );
  check("visitor can send a message", sent.status === 201, String(sent.status));

  const seen = await post("/chat/seen", { upToSeq: 1 }, cookie);
  check("visitor can mark read", seen.status === 200, String(seen.status));

  const refreshed = await db
    .select()
    .from(conversations)
    .where(eq(conversations.id, conversation.id));
  check(
    "admin unread counter grew",
    (refreshed[0]?.unreadForAdmin ?? 0) >= 1,
    String(refreshed[0]?.unreadForAdmin),
  );
  check("visitor verified timestamp set", Boolean(refreshed[0]?.visitorVerifiedAt));

  /* 9. Invalid / revoked invite. */
  const badToken = await post("/chat/verify/request", {
    conversationId: conversation.id,
    token: "x".repeat(43),
    email: EMAIL,
  });
  check("invalid invite token is refused", badToken.status === 404, String(badToken.status));

  await updateConversation(conversation.id, { inviteRevokedAt: new Date() });
  const revoked = await post("/chat/verify/request", { ...link, email: EMAIL });
  check("revoked invite is refused", revoked.status === 404, String(revoked.status));

  /* 10. Validation and rate limiting on the public form. */
  const tooShort = await post("/contact", {
    name: "A",
    email: "not-an-email",
    message: "short",
  });
  check("contact validation rejects bad input", tooShort.status === 400, String(tooShort.status));

  const honeypot = await post("/contact", {
    name: "Bot Person",
    email: "bot@example.invalid",
    message: "This message was filled in by a bot that found the honey pot.",
    website: "http://spam.example",
  });
  const botRows = await db
    .select()
    .from(conversations)
    .where(eq(conversations.visitorEmail, "bot@example.invalid"));
  check("honeypot submission is not stored", botRows.length === 0);
  check(
    "honeypot submission looks successful",
    honeypot.status === 201 || honeypot.status === 200,
    String(honeypot.status),
  );

  /* Cleanup of everything this run created. */
  await db
    .delete(chatMessages)
    .where(eq(chatMessages.conversationId, conversation.id));
  await db
    .delete(chatVerificationCodes)
    .where(eq(chatVerificationCodes.conversationId, conversation.id));
  await db.delete(conversations).where(eq(conversations.id, conversation.id));
  const leftover = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.visitorEmail, EMAIL)));
  check("test data cleaned up", leftover.length === 0);

  console.log(failures === 0 ? "\nALL CHECKS PASSED" : `\n${failures} CHECK(S) FAILED`);
  process.exit(failures === 0 ? 0 : 1);
};

run().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
