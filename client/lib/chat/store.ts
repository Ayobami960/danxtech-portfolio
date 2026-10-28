import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { chatApi } from "./api";
import chatReducer from "./chatSlice";

/** A fresh store per mount, so chat code never leaks into the landing store. */
export const makeChatStore = () => {
  const store = configureStore({
    reducer: {
      [chatApi.reducerPath]: chatApi.reducer,
      chat: chatReducer,
    },
    middleware: (getDefault) =>
      getDefault({ serializableCheck: true, immutableCheck: true }).concat(
        chatApi.middleware,
      ),
    devTools: process.env.NODE_ENV !== "production",
  });
  setupListeners(store.dispatch);
  return store;
};

export type ChatStore = ReturnType<typeof makeChatStore>;
export type ChatRootState = ReturnType<ChatStore["getState"]>;
export type ChatDispatch = ChatStore["dispatch"];
