type ChannelMessage =
  | { type: "logout" }
  | { type: "activity" };

const channel =
  typeof BroadcastChannel === "undefined"
    ? null
    : new BroadcastChannel("admin-session");

let remoteLogout = false;

export const broadcastLogout = (): void => {
  channel?.postMessage({ type: "logout" } satisfies ChannelMessage);
};

export const broadcastActivity = (): void => {
  channel?.postMessage({ type: "activity" } satisfies ChannelMessage);
};

export const consumeRemoteLogout = (): boolean => {
  if (!remoteLogout) return false;
  remoteLogout = false;
  return true;
};

export const subscribeChannel = (
  handlers: {
    onLogout: () => void;
    onActivity: () => void;
  },
): (() => void) => {
  if (!channel) return () => undefined;
  const listener = (event: MessageEvent<ChannelMessage>): void => {
    if (event.data?.type === "logout") {
      remoteLogout = true;
      handlers.onLogout();
    } else if (event.data?.type === "activity") {
      handlers.onActivity();
    }
  };
  channel.addEventListener("message", listener);
  return () => channel.removeEventListener("message", listener);
};
