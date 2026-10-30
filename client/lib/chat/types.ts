export type ChatSender = "visitor" | "admin" | "system";

export type DeliveryStatus = "sending" | "sent" | "delivered" | "read" | "failed";

export type RawChatMessage = {
  id: string;
  seq: number;
  conversationId: string;
  sender: ChatSender;
  body: string;
  imageUrl: string | null;
  imageMimeType: string | null;
  attachmentName: string | null;
  clientMsgId: string | null;
  deliveredAt: string | null;
  readAt: string | null;
  createdAt: string;
};

export type ChatMessage = RawChatMessage & { status: DeliveryStatus };

export type ChatConversation = {
  id: string;
  subject: string | null;
  status: "new" | "open" | "closed";
};

/** Rejoin with an existing session (no new token). */
export type JoinResponse = {
  conversation: ChatConversation;
  messages: RawChatMessage[];
  developer: { name: string };
};

/** A confirmed OTP also returns the signed visitor session. */
export type VerifyResponse = JoinResponse & { guestToken: string };

export type VerificationRequestResult = {
  ok: boolean;
  message: string;
};

export type MessagePage = {
  data: RawChatMessage[];
  meta: { hasMore: boolean; oldestSeq: number | null; newestSeq: number | null };
};

export type Ack = {
  ok: boolean;
  message?: RawChatMessage;
  error?: { code?: string; message?: string };
};

export type ChatPhase =
  | "joining"
  | "verify"
  | "ready"
  | "invalid"
  | "expired"
  | "revoked"
  | "closed"
  | "error";

export type ChatLink = { conversationId: string; token: string };

export type ConnectionState = "connecting" | "live" | "reconnecting" | "degraded";

export type StoredChatSession = {
  token: string;
  conversation: ChatConversation;
  developerName: string;
};

export const statusFromMessage = (message: RawChatMessage): DeliveryStatus => {
  if (message.readAt) return "read";
  if (message.deliveredAt) return "delivered";
  return "sent";
};
