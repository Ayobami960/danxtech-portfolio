import type { StoredChatSession } from "./types";

const SESSION_KEY = "chat.session";

let guestToken: string | null = null;

export const getGuestToken = (): string | null => {
  if (guestToken) return guestToken;
  if (typeof window === "undefined") return null;
  try {
    return sessionStorage.getItem(SESSION_KEY) ? readChatSession()?.token ?? null : null;
  } catch {
    return null;
  }
};

export const setGuestToken = (token: string): void => {
  guestToken = token;
};

export const saveChatSession = (session: StoredChatSession): void => {
  guestToken = session.token;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch {
    /* storage may be full or blocked — the in-memory token still works */
  }
};

export const readChatSession = (): StoredChatSession | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredChatSession;
    if (!parsed.token || !parsed.conversation?.id) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const clearChatSession = (): void => {
  guestToken = null;
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    /* ignore */
  }
};
