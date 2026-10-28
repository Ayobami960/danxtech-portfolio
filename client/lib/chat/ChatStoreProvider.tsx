"use client";

import { useState, type ReactNode } from "react";
import { Provider } from "react-redux";
import { makeChatStore, type ChatStore } from "./store";

export const ChatStoreProvider = ({ children }: { children: ReactNode }) => {
  const [store] = useState<ChatStore>(() => makeChatStore());

  return <Provider store={store}>{children}</Provider>;
};
