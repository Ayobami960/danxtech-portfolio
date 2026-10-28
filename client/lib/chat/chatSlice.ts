import {
  createEntityAdapter,
  createSlice,
  type EntityState,
  type PayloadAction,
} from "@reduxjs/toolkit";
import {
  statusFromMessage,
  type ChatConversation,
  type ChatMessage,
  type ChatPhase,
  type ConnectionState,
  type RawChatMessage,
} from "./types";

const adapter = createEntityAdapter<ChatMessage>({
  // Optimistic messages have seq 0 and sort after everything persisted.
  sortComparer: (a, b) =>
    (a.seq || Number.MAX_SAFE_INTEGER) - (b.seq || Number.MAX_SAFE_INTEGER) ||
    a.createdAt.localeCompare(b.createdAt),
});

export type ChatState = {
  phase: ChatPhase;
  conversation: ChatConversation | null;
  developerName: string;
  connection: ConnectionState;
  adminOnline: boolean;
  adminTyping: boolean;
  messages: EntityState<ChatMessage, string>;
  hasMoreHistory: boolean;
  loadingHistory: boolean;
};

const initialState: ChatState = {
  phase: "joining",
  conversation: null,
  developerName: "Adetoye Daniel Kehinde",
  connection: "connecting",
  adminOnline: false,
  adminTyping: false,
  messages: adapter.getInitialState(),
  hasMoreHistory: false,
  loadingHistory: false,
};

const asChatMessage = (message: RawChatMessage): ChatMessage => ({
  ...message,
  status: message.sender === "visitor" ? statusFromMessage(message) : "read",
});

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    joinStarted(state) {
      state.phase = "joining";
    },
    joinSucceeded(
      state,
      action: PayloadAction<{
        conversation: ChatConversation;
        developerName: string;
        messages: RawChatMessage[];
      }>,
    ) {
      state.phase = action.payload.conversation.status === "closed" ? "closed" : "ready";
      state.conversation = action.payload.conversation;
      state.developerName = action.payload.developerName;
      state.hasMoreHistory = action.payload.messages.length >= 50;
      adapter.setAll(state.messages, action.payload.messages.map(asChatMessage));
    },
    joinFailed(state, action: PayloadAction<ChatPhase>) {
      state.phase = action.payload;
    },
    conversationClosed(state) {
      state.phase = "closed";
      if (state.conversation) state.conversation.status = "closed";
    },
    connectionChanged(state, action: PayloadAction<ConnectionState>) {
      state.connection = action.payload;
    },
    presenceChanged(state, action: PayloadAction<boolean>) {
      state.adminOnline = action.payload;
    },
    typingChanged(state, action: PayloadAction<boolean>) {
      state.adminTyping = action.payload;
    },
    messageQueued(
      state,
      action: PayloadAction<{
        clientMsgId: string;
        body: string;
        conversationId: string;
        imageUrl?: string | null;
      }>,
    ) {
      adapter.upsertOne(state.messages, {
        id: action.payload.clientMsgId,
        clientMsgId: action.payload.clientMsgId,
        conversationId: action.payload.conversationId,
        sender: "visitor",
        body: action.payload.body,
        imageUrl: action.payload.imageUrl ?? null,
        seq: 0,
        deliveredAt: null,
        readAt: null,
        createdAt: new Date().toISOString(),
        status: "sending",
      });
    },
    messageAccepted(
      state,
      action: PayloadAction<{ clientMsgId: string; message: RawChatMessage }>,
    ) {
      adapter.removeOne(state.messages, action.payload.clientMsgId);
      adapter.upsertOne(state.messages, asChatMessage(action.payload.message));
    },
    messageFailed(state, action: PayloadAction<{ clientMsgId: string }>) {
      adapter.updateOne(state.messages, {
        id: action.payload.clientMsgId,
        changes: { status: "failed" },
      });
    },
    messageReceived(state, action: PayloadAction<RawChatMessage>) {
      if (action.payload.clientMsgId) {
        adapter.removeOne(state.messages, action.payload.clientMsgId);
      }
      adapter.upsertOne(state.messages, asChatMessage(action.payload));
    },
    messagesReceived(state, action: PayloadAction<RawChatMessage[]>) {
      for (const message of action.payload) {
        if (message.clientMsgId) adapter.removeOne(state.messages, message.clientMsgId);
        adapter.upsertOne(state.messages, asChatMessage(message));
      }
    },
    statusApplied(
      state,
      action: PayloadAction<{ upToSeq: number; readAt: string | null }>,
    ) {
      for (const message of adapter.getSelectors().selectAll(state.messages)) {
        if (message.sender !== "visitor" || message.seq === 0) continue;
        if (message.seq > action.payload.upToSeq) continue;
        adapter.updateOne(state.messages, {
          id: message.id,
          changes: {
            deliveredAt: message.deliveredAt ?? action.payload.readAt,
            readAt: action.payload.readAt ?? message.readAt,
            status: action.payload.readAt ? "read" : message.status,
          },
        });
      }
    },
    historyStarted(state) {
      state.loadingHistory = true;
    },
    historyPrepended(
      state,
      action: PayloadAction<{ messages: RawChatMessage[]; hasMore: boolean }>,
    ) {
      adapter.upsertMany(state.messages, action.payload.messages.map(asChatMessage));
      state.hasMoreHistory = action.payload.hasMore;
      state.loadingHistory = false;
    },
    historyFinished(state) {
      state.loadingHistory = false;
    },
    resetChat() {
      return initialState;
    },
  },
});

export const {
  joinStarted,
  joinSucceeded,
  joinFailed,
  conversationClosed,
  connectionChanged,
  presenceChanged,
  typingChanged,
  messageQueued,
  messageAccepted,
  messageFailed,
  messageReceived,
  messagesReceived,
  statusApplied,
  historyStarted,
  historyPrepended,
  historyFinished,
  resetChat,
} = chatSlice.actions;

export const chatSelectors = adapter.getSelectors();
export default chatSlice.reducer;
