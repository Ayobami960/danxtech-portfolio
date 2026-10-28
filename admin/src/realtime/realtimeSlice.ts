import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ConnectionStatus } from "./socket";

export type RealtimeState = {
  connection: ConnectionStatus;
  presenceByConversation: Record<
    string,
    { visitorOnline: boolean; adminOnline: boolean; adminViewing: boolean }
  >;
  typingByConversation: Record<string, boolean>;
  lastEventAt: number | null;
};

const initialState: RealtimeState = {
  connection: "offline",
  presenceByConversation: {},
  typingByConversation: {},
  lastEventAt: null,
};

const realtimeSlice = createSlice({
  name: "realtime",
  initialState,
  reducers: {
    setConnection(state, action: PayloadAction<ConnectionStatus>) {
      state.connection = action.payload;
    },
    setPresence(
      state,
      action: PayloadAction<{
        conversationId: string;
        visitorOnline: boolean;
        adminOnline: boolean;
        adminViewing: boolean;
      }>,
    ) {
      state.presenceByConversation[action.payload.conversationId] = {
        visitorOnline: action.payload.visitorOnline,
        adminOnline: action.payload.adminOnline,
        adminViewing: action.payload.adminViewing,
      };
      state.lastEventAt = Date.now();
    },
    setTyping(
      state,
      action: PayloadAction<{ conversationId: string; isTyping: boolean }>,
    ) {
      state.typingByConversation[action.payload.conversationId] =
        action.payload.isTyping;
      state.lastEventAt = Date.now();
    },
    noteEvent(state) {
      state.lastEventAt = Date.now();
    },
    resetRealtime() {
      return initialState;
    },
  },
});

export const {
  setConnection,
  setPresence,
  setTyping,
  noteEvent,
  resetRealtime,
} = realtimeSlice.actions;

export default realtimeSlice.reducer;
