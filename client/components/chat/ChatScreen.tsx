"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCheck,
  ImagePlus,
  Loader2,
  Lock,
  LogOut,
  Mail,
  RotateCcw,
  Send,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  uploadChatImage,
  useConfirmCodeMutation,
  useJoinMutation,
  useLazyGetMessagesQuery,
  useLogoutMutation,
  useMarkSeenMutation,
  useRequestCodeMutation,
  useSendMessageMutation,
} from "@/lib/chat/api";
import { chatSelectors } from "@/lib/chat/chatSlice";
import {
  conversationClosed,
  connectionChanged,
  historyFinished,
  historyPrepended,
  historyStarted,
  joinFailed,
  joinSucceeded,
  messageAccepted,
  messageFailed,
  messageQueued,
  messageReceived,
  messagesReceived,
  presenceChanged,
  statusApplied,
  typingChanged,
} from "@/lib/chat/chatSlice";
import {
  connectChat,
  disconnectChat,
  emitSeen,
  emitTyping,
  isChatLive,
  sendOverSocket,
} from "@/lib/chat/connection";
import { useChatDispatch, useChatSelector } from "@/lib/chat/hooks";
import {
  clearChatSession,
  getGuestToken,
  readChatSession,
  saveChatSession,
  setGuestToken,
} from "@/lib/chat/session";
import type {
  ChatConversation,
  ChatLink,
  ChatMessage,
  RawChatMessage,
} from "@/lib/chat/types";

const TITLE = "Live chat · Adetoye Daniel Kehinde";

/** The invite link carries both the conversation id and the invite token. */
const readChatLink = (): ChatLink | null => {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const conversationId = params.get("c");
  const token = params.get("t");
  return conversationId && token ? { conversationId, token } : null;
};

/** Human-readable message from an RTK Query error. */
const apiErrorText = (error: unknown, fallback: string): string => {
  const data = (error as { data?: { error?: { message?: unknown } } }).data;
  const message = data?.error?.message;
  return typeof message === "string" && message.length > 0 ? message : fallback;
};

const formatTime = (iso: string): string =>
  new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));

const dayLabel = (iso: string): string =>
  new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(iso));

/** Render plain text only; linkify http(s) URLs with safe rel attributes. */
const renderBody = (body: string): React.ReactNode =>
  body.split(/(https?:\/\/[^\s]+)/g).map((part, index) =>
    /^https?:\/\//.test(part) ? (
      <a
        key={index}
        href={part}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="underline decoration-[#3b82f6]/50 underline-offset-2 hover:text-white"
      >
        {part}
      </a>
    ) : (
      <span key={index}>{part}</span>
    ),
  );

/** Six single-digit boxes: auto-advance, paste and numeric keypad. */
const CodeInput = ({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  disabled: boolean;
}) => {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, index) => value[index] ?? "");

  const setDigit = (index: number, raw: string): void => {
    const digit = raw.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    onChange(next.join("").slice(0, 6));
    if (digit && index < 5) refs.current[index + 1]?.focus();
  };

  return (
    <div
      className="flex justify-between gap-1.5"
      role="group"
      aria-label="6-digit verification code"
    >
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element;
          }}
          value={digit}
          onChange={(event) => setDigit(index, event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !digit && index > 0) {
              refs.current[index - 1]?.focus();
            }
          }}
          onPaste={(event) => {
            event.preventDefault();
            const pasted = event.clipboardData
              .getData("text")
              .replace(/\D/g, "")
              .slice(0, 6);
            if (!pasted) return;
            onChange(pasted);
            refs.current[Math.min(pasted.length, 5)]?.focus();
          }}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          disabled={disabled}
          autoFocus={index === 0}
          aria-label={`Digit ${index + 1} of 6`}
          className="h-12 w-full rounded-xl border border-white/10 bg-[#0a1024] text-center font-mono text-lg text-white outline-none transition-colors focus:border-[#3b82f6]/60 disabled:opacity-60"
        />
      ))}
    </div>
  );
};

const Ticks = ({ message }: { message: ChatMessage }) => {
  if (message.status === "sending") {
    return <Loader2 size={11} className="animate-spin opacity-60" aria-label="Sending" />;
  }
  if (message.status === "failed") return null;
  if (message.status === "read") {
    return <CheckCheck size={13} className="text-[#3b82f6]" aria-label="Read" />;
  }
  if (message.status === "delivered") {
    return <CheckCheck size={13} className="opacity-70" aria-label="Delivered" />;
  }
  return <Check size={12} className="opacity-70" aria-label="Sent" />;
};

export default function ChatScreen() {
  const dispatch = useChatDispatch();
  const phase = useChatSelector((state) => state.chat.phase);
  const conversation = useChatSelector((state) => state.chat.conversation);
  const developerName = useChatSelector((state) => state.chat.developerName);
  const connection = useChatSelector((state) => state.chat.connection);
  const adminOnline = useChatSelector((state) => state.chat.adminOnline);
  const adminTyping = useChatSelector((state) => state.chat.adminTyping);
  const hasMoreHistory = useChatSelector((state) => state.chat.hasMoreHistory);
  const loadingHistory = useChatSelector((state) => state.chat.loadingHistory);
  const messages = useChatSelector((state) =>
    chatSelectors.selectAll(state.chat.messages),
  );

  const [join] = useJoinMutation();
  const [fetchMessages] = useLazyGetMessagesQuery();
  const [sendRest] = useSendMessageMutation();
  const [markSeenRest] = useMarkSeenMutation();

  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);
  const [showJump, setShowJump] = useState(false);

  const latestSeqRef = useRef(0);
  const lastSeenRef = useRef(0);
  const typingTimer = useRef<number | null>(null);
  const lastTypingAt = useRef(0);
  const scroller = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);

  const shortName = developerName.includes("Daniel")
    ? "Daniel"
    : developerName.split(" ")[0] || "Daniel";
  const closed = phase === "closed" || conversation?.status === "closed";
  const ready = phase === "ready";

  const newestSeq = useMemo(
    () => messages.reduce((max, message) => Math.max(max, message.seq), 0),
    [messages],
  );

  /* ------------------------------ verification ------------------------------ */
  const [requestCode, requestState] = useRequestCodeMutation();
  const [confirmCode, confirmState] = useConfirmCodeMutation();
  const [logoutRest] = useLogoutMutation();
  const [link, setLink] = useState<ChatLink | null>(null);
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resendIn, setResendIn] = useState(0);
  const [uploading, setUploading] = useState(false);
  const attachInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setTimeout(() => setResendIn((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  /* -------------------------------- join/resume ------------------------------- */

  /** Connect the socket and hydrate the store for a verified conversation. */
  const openConversation = (
    conv: ChatConversation,
    developer: string,
    history: RawChatMessage[],
  ): void => {
    dispatch(
      joinSucceeded({ conversation: conv, developerName: developer, messages: history }),
    );
    latestSeqRef.current = history.reduce(
      (max, message) => Math.max(max, message.seq),
      0,
    );
    lastSeenRef.current = latestSeqRef.current;

    if (conv.status === "closed") {
      dispatch(connectionChanged("degraded"));
      return;
    }

    const markSeenUpTo = (upToSeq: number): void => {
      if (upToSeq <= 0) return;
      if (isChatLive()) emitSeen(conv.id, upToSeq);
      else void markSeenRest({ upToSeq }).unwrap().catch(() => undefined);
    };

    connectChat(getGuestToken() ?? "", {
      onConnect: () => {
        dispatch(connectionChanged("live"));
        void fetchMessages({ after: latestSeqRef.current })
          .unwrap()
          .then((page) => {
            if (page.data.length > 0) {
              dispatch(messagesReceived(page.data));
              latestSeqRef.current = Math.max(
                latestSeqRef.current,
                ...page.data.map((message) => message.seq),
              );
              if (document.visibilityState === "visible") {
                markSeenUpTo(latestSeqRef.current);
              }
            }
          })
          .catch(() => undefined);
      },
      onDisconnect: () => dispatch(connectionChanged("reconnecting")),
      onConnectError: () => dispatch(connectionChanged("degraded")),
      onMessage: (message) => {
        dispatch(messageReceived(message));
        latestSeqRef.current = Math.max(latestSeqRef.current, message.seq);
        if (document.visibilityState === "visible") {
          markSeenUpTo(message.seq);
        }
      },
      onStatus: (payload) => dispatch(statusApplied(payload)),
      onTyping: (isTyping) => dispatch(typingChanged(isTyping)),
      onPresence: (online) => dispatch(presenceChanged(online)),
      onClosed: () => {
        dispatch(conversationClosed());
        disconnectChat();
      },
      onRevoked: () => {
        dispatch(joinFailed("revoked"));
        disconnectChat();
      },
    });
  };

  const sendCode = async (address: string): Promise<void> => {
    if (!link) return;
    setVerifyError(null);
    try {
      const result = await requestCode({ ...link, email: address }).unwrap();
      setEmail(address);
      setStep("code");
      setNotice(result.message);
      setResendIn(60);
    } catch (error) {
      const status = (error as { status?: number | string }).status;
      setVerifyError(
        status === 429
          ? "Too many requests. Please wait a few minutes and try again."
          : apiErrorText(error, "The code could not be sent. Please try again."),
      );
    }
  };

  const submitCode = async (): Promise<void> => {
    if (!link || code.length !== 6) return;
    setVerifyError(null);
    try {
      const result = await confirmCode({ ...link, email, code }).unwrap();
      setGuestToken(result.guestToken);
      saveChatSession({
        token: result.guestToken,
        conversation: result.conversation,
        developerName: result.developer.name,
      });
      setLink(null);
      openConversation(result.conversation, result.developer.name, result.messages);
    } catch (error) {
      const status = (error as { status?: number | string }).status;
      setCode("");
      setVerifyError(
        status === 429
          ? apiErrorText(error, "Too many attempts. Request a new code.")
          : apiErrorText(error, "The code could not be verified."),
      );
    }
  };

  const signOut = async (): Promise<void> => {
    clearChatSession();
    disconnectChat();
    void logoutRest().unwrap().catch(() => undefined);
    window.location.href = "/";
  };

  useEffect(() => {
    let cancelled = false;

    if (typeof window !== "undefined") {
      document.title = TITLE;
    }

    const chatLink = readChatLink();
    if (chatLink) {
      // Keep the fragment out of the address bar (and out of any history).
      window.history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
      // One-shot mount read: the invite lives in the URL fragment and is shown
      // behind the email step, so no chat content is visible yet. This is not a
      // cascading update, it runs exactly once.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLink(chatLink);
      dispatch(joinFailed("verify"));
      return;
    }

    const stored = readChatSession();
    if (!stored) {
      dispatch(joinFailed("invalid"));
      return;
    }

    setGuestToken(stored.token);
    void join()
      .unwrap()
      .then((result) => {
        if (cancelled) return;
        openConversation(result.conversation, result.developer.name, result.messages);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        const status = (error as { status?: number | string }).status;
        if (status === 410) {
          dispatch(joinFailed("closed"));
        } else if (status === 404 || status === 401 || status === 400) {
          clearChatSession();
          dispatch(joinFailed("invalid"));
        } else {
          dispatch(joinFailed("error"));
        }
      });

    return () => {
      cancelled = true;
      disconnectChat();
      if (typingTimer.current) window.clearTimeout(typingTimer.current);
    };
    // The session is opened once per mount; handlers read refs for fresh state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --------------------------- polling when degraded -------------------------- */
  useEffect(() => {
    if (!ready || conversation?.status === "closed" || connection === "live") return;
    const interval = window.setInterval(() => {
      void fetchMessages({ after: latestSeqRef.current })
        .unwrap()
        .then((page) => {
          if (page.data.length === 0) return;
          dispatch(messagesReceived(page.data));
          latestSeqRef.current = Math.max(
            latestSeqRef.current,
            ...page.data.map((message) => message.seq),
          );
        })
        .catch(() => undefined);
    }, 5_000);
    return () => window.clearInterval(interval);
  }, [ready, conversation?.status, connection, fetchMessages, dispatch]);

  /* -------------------------------- read receipts ------------------------------ */
  useEffect(() => {
    if (!ready || !conversation || newestSeq <= lastSeenRef.current) return;
    if (document.visibilityState !== "visible") return;
    lastSeenRef.current = newestSeq;
    if (isChatLive()) emitSeen(conversation.id, newestSeq);
    else void markSeenRest({ upToSeq: newestSeq }).unwrap().catch(() => undefined);
  }, [ready, conversation, newestSeq, markSeenRest]);

  /* ----------------------------------- title ---------------------------------- */
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.sender !== "admin" || document.visibilityState === "visible") return;
    document.title = "New reply · Live chat";
    const restore = (): void => {
      if (document.visibilityState === "visible") document.title = TITLE;
    };
    document.addEventListener("visibilitychange", restore);
    return () => {
      document.removeEventListener("visibilitychange", restore);
      document.title = TITLE;
    };
  }, [messages]);

  /* --------------------------------- autoscroll -------------------------------- */
  useEffect(() => {
    if (atBottom.current) {
      bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages.length]);

  /* ----------------------------------- send ----------------------------------- */
  const deliver = async (clientMsgId: string, body: string): Promise<void> => {
    setSendError(null);
    if (isChatLive()) {
      const ack = await sendOverSocket({ clientMsgId, body });
      if (ack.ok && ack.message) {
        dispatch(messageAccepted({ clientMsgId, message: ack.message }));
      } else {
        dispatch(messageFailed({ clientMsgId }));
        if (ack.error?.message) setSendError(ack.error.message);
      }
      return;
    }
    try {
      const message = await sendRest({ clientMsgId, body }).unwrap();
      dispatch(messageAccepted({ clientMsgId, message }));
    } catch (error) {
      dispatch(messageFailed({ clientMsgId }));
      const status = (error as { status?: number | string }).status;
      setSendError(
        status === 429
          ? "You're sending messages too quickly. Please wait a moment."
          : "Message not sent. Check your connection and retry.",
      );
    }
  };

  const submit = async (): Promise<void> => {
    const body = draft.trim();
    if (!body || !ready || !conversation || closed) return;
    const clientMsgId = crypto.randomUUID();
    dispatch(messageQueued({ clientMsgId, body, conversationId: conversation.id }));
    setDraft("");
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    if (isChatLive()) emitTyping(conversation.id, false);
    await deliver(clientMsgId, body);
  };

  /** Upload through the backend, then post the message that references it. */
  const sendImage = async (file: File): Promise<void> => {
    if (!conversation || closed) return;
    setSendError(null);
    setUploading(true);
    try {
      const { key } = await uploadChatImage(file);
      const body = draft.trim();
      const clientMsgId = crypto.randomUUID();
      setDraft("");

      if (isChatLive()) {
        const ack = await sendOverSocket({ clientMsgId, body, imageKey: key });
        if (!ack.ok) {
          setSendError(ack.error?.message ?? "The image could not be sent.");
        }
      } else {
        await sendRest({ clientMsgId, body, imageKey: key }).unwrap();
      }
    } catch (error) {
      setSendError(
        error instanceof Error && error.message
          ? error.message
          : "The image could not be uploaded. Please try again.",
      );
    } finally {
      setUploading(false);
      if (attachInput.current) attachInput.current.value = "";
    }
  };

  const retry = async (message: ChatMessage): Promise<void> => {
    if (!message.clientMsgId || !conversation) return;
    dispatch(
      messageQueued({
        clientMsgId: message.clientMsgId,
        body: message.body,
        conversationId: conversation.id,
      }),
    );
    await deliver(message.clientMsgId, message.body);
  };

  const loadEarlier = async (): Promise<void> => {
    const oldest = messages.find((message) => message.seq > 0)?.seq;
    if (!oldest) return;
    dispatch(historyStarted());
    try {
      const page = await fetchMessages({ before: oldest }).unwrap();
      dispatch(historyPrepended({ messages: page.data, hasMore: page.meta.hasMore }));
    } catch {
      dispatch(historyFinished());
    }
  };

  const onChangeDraft = (value: string): void => {
    setDraft(value);
    if (!conversation || !ready || closed || !isChatLive()) return;
    const now = Date.now();
    if (value.trim() && now - lastTypingAt.current > 1_500) {
      lastTypingAt.current = now;
      emitTyping(conversation.id, true);
    }
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      emitTyping(conversation.id, false);
      lastTypingAt.current = 0;
    }, 1_200);
  };

  /* --------------------------------- render ----------------------------------- */
  if (phase === "joining") {
    return (
      <div className="flex min-h-screen items-center justify-center px-6!">
        <div className="flex flex-col items-center gap-3 text-center" role="status">
          <Loader2 size={26} className="animate-spin text-[#3b82f6]" />
          <p className="font-grotesk text-lg text-white">Opening your chat…</p>
          <p className="font-mono text-xs text-[#7c8fa6]">Checking the invite link</p>
        </div>
      </div>
    );
  }

  if (phase === "verify" && link) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6! py-10!">
        <div className="window-card w-full max-w-md p-7!">
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#3b82f6]/30 bg-[#3b82f6]/10 text-[#93c5fd]">
            {step === "email" ? <Mail size={20} /> : <ShieldCheck size={20} />}
          </span>
          <h1 className="font-grotesk mt-4 text-xl font-bold text-white">
            {step === "email" ? "Verify your email" : "Enter your code"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-[#9db0c6]">
            {step === "email"
              ? "For security, confirm the email address you used to contact Daniel. We will send a one-time code."
              : `We sent a 6-digit code to ${email}. It expires in 10 minutes.`}
          </p>

          {step === "email" ? (
            <form
              className="mt-5 flex flex-col gap-2"
              onSubmit={(event) => {
                event.preventDefault();
                if (!requestState.isLoading && email.trim()) void sendCode(email.trim());
              }}
            >
              <label htmlFor="verify-email" className="font-mono text-xs text-[#7c8fa6]">
                Email address
              </label>
              <input
                id="verify-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-white/10 bg-[#0a1024] px-4! py-3! text-sm text-white outline-none transition-colors placeholder:text-[#3d5070] focus:border-[#3b82f6]/60"
              />
              {verifyError ? (
                <p role="alert" className="text-xs text-[#fca5a5]">
                  {verifyError}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={requestState.isLoading || !email.trim()}
                className="font-grotesk mt-2 inline-flex items-center justify-center gap-2 rounded-xl bg-[#3b82f6] px-5! py-3! text-sm font-semibold text-white transition-colors hover:bg-[#2f74e8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {requestState.isLoading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Sending code…
                  </>
                ) : (
                  <>
                    <Mail size={15} /> Send code
                  </>
                )}
              </button>
            </form>
          ) : (
            <form
              className="mt-5 flex flex-col gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                if (!confirmState.isLoading) void submitCode();
              }}
            >
              <CodeInput value={code} onChange={setCode} disabled={confirmState.isLoading} />
              {notice ? (
                <p className="text-xs text-[#9db0c6]" role="status">
                  {notice}
                </p>
              ) : null}
              {verifyError ? (
                <p role="alert" className="text-xs text-[#fca5a5]">
                  {verifyError}
                </p>
              ) : null}
              <button
                type="submit"
                disabled={confirmState.isLoading || code.length !== 6}
                className="font-grotesk inline-flex items-center justify-center gap-2 rounded-xl bg-[#3b82f6] px-5! py-3! text-sm font-semibold text-white transition-colors hover:bg-[#2f74e8] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {confirmState.isLoading ? (
                  <>
                    <Loader2 size={15} className="animate-spin" /> Verifying…
                  </>
                ) : (
                  <>
                    <ShieldCheck size={15} /> Open my chat
                  </>
                )}
              </button>
              <div className="flex items-center justify-between font-mono text-[11px] text-[#7c8fa6]">
                <button
                  type="button"
                  className="hover:text-white disabled:opacity-50"
                  disabled={resendIn > 0 || requestState.isLoading}
                  onClick={() => void sendCode(email)}
                >
                  {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
                </button>
                <button
                  type="button"
                  className="hover:text-white"
                  onClick={() => {
                    setStep("email");
                    setCode("");
                    setNotice(null);
                    setVerifyError(null);
                  }}
                >
                  Use a different email
                </button>
              </div>
            </form>
          )}

          <p className="mt-5 text-center font-mono text-[10px] text-[#4d5f77]">
            Your email is only used to open this conversation. It is never shared.
          </p>
        </div>
      </div>
    );
  }

  if (phase === "invalid" || phase === "expired" || phase === "revoked" || phase === "error") {
    const copy =
      phase === "invalid"
        ? {
            title: "This link isn't valid",
            body: "It may be incomplete or has expired. Ask Daniel for a fresh invite link.",
          }
        : phase === "expired"
          ? {
              title: "This invite has expired",
              body: "Ask Daniel for a new link and you can pick up the conversation again.",
            }
          : phase === "revoked"
            ? {
                title: "This invite was revoked",
                body: "Daniel ended this chat link. Ask him for a new invite if you'd still like to talk.",
              }
            : {
                title: "Could not open the chat",
                body: "The connection failed. Retry, or ask Daniel for a new link.",
              };

    return (
      <div className="flex min-h-screen items-center justify-center px-6!">
        <div className="window-card w-full max-w-md p-8! text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[#f0a500]/30 bg-[#f0a500]/10 text-[#f0a500]">
            {phase === "error" ? <WifiOff size={22} /> : <Lock size={22} />}
          </span>
          <h1 className="font-grotesk mt-4 text-xl font-bold text-white">{copy.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#9db0c6]">{copy.body}</p>
          <Link
            href="/"
            className="font-grotesk mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 px-5! py-2.5! text-sm font-semibold text-white transition-colors hover:border-[#3b82f6]/60"
          >
            <ArrowLeft size={15} /> Back to the portfolio
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4! py-6! sm:px-6!">
      <div className="mb-3 flex items-center justify-between">
        <Link
          href="/"
          className="inline-flex items-center gap-2 font-mono text-xs text-[#7c8fa6] transition-colors hover:text-white"
        >
          <ArrowLeft size={14} /> Portfolio
        </Link>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-[#5f7189]">
          <Lock size={11} /> Private chat
        </span>
      </div>

      <div className="window-card flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* header */}
        <header className="flex flex-wrap items-center gap-3 border-b border-white/5 bg-[#131c35]/80 px-5! py-4!">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3b82f6]/15 font-grotesk text-sm font-bold text-[#93c5fd]">
            {shortName.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-grotesk truncate font-semibold text-white">{developerName}</div>
            <div className="flex items-center gap-1.5 font-mono text-[11px]">
              <span
                className={
                  adminOnline
                    ? "h-1.5 w-1.5 rounded-full bg-[#10b981]"
                    : "h-1.5 w-1.5 rounded-full bg-[#5f7189]"
                }
              />
              <span className="text-[#7c8fa6]">
                {closed
                  ? "Conversation closed"
                  : adminOnline
                    ? `${shortName} is online`
                    : `${shortName} usually replies within a day; you'll get an email`}
              </span>
            </div>
          </div>
          {conversation?.subject ? (
            <span className="ml-auto hidden max-w-[40%] truncate rounded-full border border-white/10 px-3! py-1! font-mono text-[10px] text-[#9db0c6] sm:inline">
              {conversation.subject}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => void signOut()}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3! py-1.5! font-mono text-[10px] text-[#9db0c6] transition-colors hover:border-[#ef4444]/40 hover:text-white"
            title="Sign out of this chat"
          >
            <LogOut size={12} /> Sign out
          </button>
        </header>

        {connection !== "live" && !closed ? (
          <div
            className={`flex items-center gap-2 px-5! py-2! font-mono text-[11px] ${
              connection === "degraded"
                ? "bg-[#f0a500]/10 text-[#f0a500]"
                : "bg-white/5 text-[#9db0c6]"
            }`}
            role="status"
          >
            {connection === "degraded" ? <WifiOff size={13} /> : <Loader2 size={13} className="animate-spin" />}
            {connection === "degraded"
              ? "Slow connection — messages still send and new replies arrive every few seconds."
              : "Reconnecting… messages you send now will be delivered automatically."}
          </div>
        ) : null}

        {/* messages */}
        <div
          ref={scroller}
          onScroll={() => {
            const el = scroller.current;
            if (!el) return;
            const isBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
            atBottom.current = isBottom;
            setShowJump(!isBottom);
          }}
          className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4! py-5! sm:px-5!"
          aria-live="polite"
          aria-relevant="additions"
        >
          {hasMoreHistory ? (
            <div className="flex justify-center pb-2">
              <button
                type="button"
                className="btn-ghost rounded-full border border-white/10 px-3! py-1! font-mono text-[11px] text-[#9db0c6] hover:text-white"
                onClick={() => void loadEarlier()}
                disabled={loadingHistory}
              >
                {loadingHistory ? "Loading…" : "Load earlier messages"}
              </button>
            </div>
          ) : null}

          {messages.length === 0 ? (
            <p className="py-16! text-center text-sm text-[#7c8fa6]">
              No messages yet. Say hello to {shortName}.
            </p>
          ) : null}

          {messages.map((message, index) => {
            const previous = messages[index - 1];
            const newDay =
              !previous ||
              new Date(previous.createdAt).toDateString() !==
                new Date(message.createdAt).toDateString();
            const mine = message.sender === "visitor";
            const grouped =
              previous &&
              !newDay &&
              previous.sender === message.sender &&
              new Date(message.createdAt).getTime() -
                new Date(previous.createdAt).getTime() <
                3 * 60_000;

            if (message.sender === "system") {
              return (
                <div key={message.id} className="py-2 text-center">
                  {newDay ? (
                    <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-[#5f7189]">
                      {dayLabel(message.createdAt)}
                    </div>
                  ) : null}
                  <p className="text-xs text-[#7c8fa6]">{message.body}</p>
                </div>
              );
            }

            return (
              <div key={message.id}>
                {newDay ? (
                  <div className="my-4 text-center font-mono text-[10px] uppercase tracking-widest text-[#5f7189]">
                    {dayLabel(message.createdAt)}
                  </div>
                ) : null}
                <div className={`flex ${mine ? "justify-end" : "justify-start"} ${grouped ? "mt-0.5" : "mt-3"}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5! py-2.5! text-sm leading-relaxed sm:max-w-[75%] ${
                      mine
                        ? "rounded-br-md bg-[#3b82f6] text-white"
                        : "rounded-bl-md border border-white/8 bg-[#0e1528] text-[#e6edf7]"
                    }`}
                  >
                    {message.imageUrl ? (
                      <a
                        href={message.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mb-1.5 block"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={message.imageUrl}
                          alt="Image attachment"
                          loading="lazy"
                          className="max-h-64 w-full rounded-lg object-cover"
                        />
                      </a>
                    ) : null}
                    {message.body ? (
                      <div className="whitespace-pre-wrap break-words">{renderBody(message.body)}</div>
                    ) : null}
                    <div
                      className={`mt-1 flex items-center justify-end gap-1 font-mono text-[10px] ${
                        mine ? "text-white/60" : "text-[#5f7189]"
                      }`}
                    >
                      <span>{formatTime(message.createdAt)}</span>
                      {mine ? <Ticks message={message} /> : null}
                    </div>
                    {mine && message.status === "failed" ? (
                      <button
                        type="button"
                        className="mt-1 inline-flex items-center gap-1 font-mono text-[10px] text-[#fca5a5] hover:text-white"
                        onClick={() => void retry(message)}
                      >
                        <RotateCcw size={10} /> Retry
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}

          {adminTyping ? (
            <div className="flex justify-start pt-1">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/8 bg-[#0e1528] px-3! py-1.5!">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9db0c6] [animation-delay:-0.2s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9db0c6] [animation-delay:-0.1s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#9db0c6]" />
                <span className="ml-1 font-mono text-[10px] text-[#7c8fa6]">
                  {shortName} is typing…
                </span>
              </span>
            </div>
          ) : null}

          {showJump ? (
            <div className="sticky bottom-2 z-10 flex justify-center pt-2">
              <button
                type="button"
                className="rounded-full border border-[#3b82f6]/40 bg-[#131c35] px-3! py-1.5! font-mono text-[11px] text-[#93c5fd] shadow-lg"
                onClick={() => {
                  atBottom.current = true;
                  setShowJump(false);
                  bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
                }}
              >
                Jump to latest
              </button>
            </div>
          ) : null}

          <div ref={bottom} />
        </div>

        {/* composer */}
        <div className="border-t border-white/5 bg-[#0a1024]/60 px-4! py-3! sm:px-5!">
          {sendError ? (
            <div className="mb-2 flex items-center gap-2 rounded-lg border border-[#ef4444]/25 bg-[#ef4444]/10 px-3! py-1.5! text-[11px] text-[#fca5a5]">
              <AlertTriangle size={12} /> {sendError}
            </div>
          ) : null}

          <div className="flex items-end gap-2">
            <input
              ref={attachInput}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void sendImage(file);
              }}
            />
            <button
              type="button"
              onClick={() => attachInput.current?.click()}
              disabled={closed || !ready || uploading}
              aria-label="Attach an image"
              title="Attach an image"
              className="inline-flex h-[44px] w-[44px] items-center justify-center rounded-xl border border-white/10 text-[#9db0c6] transition-colors hover:border-[#3b82f6]/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ImagePlus size={16} />
              )}
            </button>
            <label className="sr-only" htmlFor="chat-input">
              Message
            </label>
            <textarea
              id="chat-input"
              rows={1}
              value={draft}
              maxLength={2000}
              disabled={closed || !ready}
              placeholder={
                closed ? "This conversation was closed" : "Write a message…"
              }
              onChange={(event) => onChangeDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void submit();
                }
              }}
              className="max-h-32 min-h-[44px] flex-1 resize-none rounded-xl border border-white/10 bg-[#0a1024] px-3.5! py-2.5! text-sm text-white outline-none transition-colors placeholder:text-[#3d5070] focus:border-[#3b82f6]/60 disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => void submit()}
              disabled={closed || !ready || draft.trim().length === 0}
              className="font-grotesk inline-flex h-[44px] items-center gap-2 rounded-xl bg-[#3b82f6] px-4! text-sm font-semibold text-white transition-colors hover:bg-[#2f74e8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Send size={15} /> Send
            </button>
          </div>

          <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 font-mono text-[10px] text-[#5f7189]">
            <span>Enter to send · Shift+Enter for a new line</span>
            <span>{draft.length}/2000</span>
          </div>

          <p className="mt-2 text-center font-mono text-[10px] text-[#4d5f77]">
            Messages are stored so {shortName} can reply. Your email isn&apos;t shared.
          </p>
        </div>
      </div>
    </div>
  );
}
