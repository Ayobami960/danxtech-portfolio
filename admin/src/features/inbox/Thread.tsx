import {
  Archive,
  ArrowDown,
  Check,
  CheckCheck,
  Copy,
  FileText,
  Info,
  Loader2,
  Mail,
  MessageCircle,
  Paperclip,
  RotateCcw,
  Send,
  ShieldAlert,
  Star,
  Ticket,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  useCreateInviteMutation,
  useDeleteConversationMutation,
  useGetConversationQuery,
  useGetMessagesQuery,
  useLazyGetMessagesQuery,
  useMarkConversationReadMutation,
  useResendInviteMutation,
  useRevokeInviteMutation,
  useSendConversationMessageMutation,
  useUpdateConversationMutation,
} from "../../api/adminApi";
import type { ChatMessage, Conversation } from "../../api/types";
import { errorMessage } from "../../api/errors";
import { useAppSelector } from "../../store/hooks";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ErrorState, LoadingList } from "../../components/States";
import { Toggle } from "../../components/Fields";
import { cn } from "../../lib/cn";
import { uploadChatAttachment } from "../../lib/cloudinary";
import { formatDate, formatDay, relativeTime } from "../../lib/format";
import {
  emitMessage,
  emitSeen,
  emitTyping,
  isLive,
  joinConversation,
  leaveConversation,
} from "../../realtime/socket";

type PendingMessage = {
  clientMsgId: string;
  body: string;
  status: "sending" | "failed";
};

/** Older rows carry no type; they were all images. */
const isImageMessage = (message: ChatMessage): boolean =>
  !message.imageMimeType || message.imageMimeType.startsWith("image/");

const Ticks = ({ message }: { message: ChatMessage }) => {
  if (message.readAt) {
    return <CheckCheck size={13} className="cx-tick read" aria-label="Read" />;
  }
  if (message.deliveredAt) {
    return <CheckCheck size={13} className="cx-tick" aria-label="Delivered" />;
  }
  return <Check size={13} className="cx-tick" aria-label="Sent" />;
};

const InvitePanel = ({ conversation }: { conversation: Conversation }) => {
  const [createInvite, createState] = useCreateInviteMutation();
  const [resendInvite, resendState] = useResendInviteMutation();
  const [revokeInvite, revokeState] = useRevokeInviteMutation();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const status = conversation.invite.status;

  const copy = async (link: string): Promise<void> => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Invite link copied");
    } catch {
      toast.error("Copy failed — select the link manually.");
    }
  };

  const send = async (resend: boolean): Promise<void> => {
    try {
      const action = resend ? resendInvite : createInvite;
      const result = await action({
        id: conversation.id,
        sendEmail,
        ...(note.trim() ? { note: note.trim() } : {}),
      }).unwrap();
      setLastLink(result.link);
      setOpen(false);
      setNote("");
      toast.success(
        result.emailSent
          ? `Invite emailed to ${conversation.visitorEmail}`
          : "Invite created — copy the link below",
      );
    } catch (error) {
      toast.error(errorMessage(error, "Could not create the invite."));
    }
  };

  const chipClass =
    status === "active"
      ? "open"
      : status === "revoked"
        ? "spam"
        : status === "expired"
          ? "archived"
          : "";

  return (
    <div className="cx-invite">
      <div className="cx-invite-row">
        <span className="cx-invite-title">
          <Ticket size={13} /> Chat invite
        </span>
        <span className={cn("cx-chip", chipClass)}>
          {status === "none" ? "Not invited" : status}
        </span>
        {conversation.invite.expiresAt && status === "active" ? (
          <span className="mono" style={{ color: "var(--mute)" }}>
            expires {formatDate(conversation.invite.expiresAt)}
          </span>
        ) : null}
        <span
          className={cn("cx-verified", conversation.visitorVerifiedAt && "ok")}
          title={
            conversation.visitorVerifiedAt
              ? `Verified ${formatDate(conversation.visitorVerifiedAt)}`
              : "The visitor has not verified their email yet"
          }
        >
          <ShieldAlert size={11} />
          {conversation.visitorVerifiedAt ? "visitor verified" : "not verified"}
        </span>

        <div className="cx-invite-actions">
          {status === "none" || status === "expired" ? (
            <button
              type="button"
              className="btn btn-primary cx-btn-sm"
              onClick={() => setOpen(true)}
            >
              <Mail size={13} /> Send chat invite
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-ghost cx-btn-sm"
                onClick={() => {
                  if (lastLink) void copy(lastLink);
                  else void send(true);
                }}
                disabled={resendState.isLoading}
              >
                <Copy size={13} /> Copy link
              </button>
              <button
                type="button"
                className="btn btn-ghost cx-btn-sm"
                onClick={() => void send(true)}
                disabled={resendState.isLoading}
              >
                <RotateCcw size={13} /> Resend
              </button>
              {status === "active" ? (
                <button
                  type="button"
                  className="btn btn-danger cx-btn-sm"
                  onClick={() => setConfirmRevoke(true)}
                  disabled={revokeState.isLoading}
                >
                  <X size={13} /> Revoke
                </button>
              ) : null}
            </>
          )}
        </div>
      </div>

      <p className="cx-invite-note">
        Only sent to the email the visitor entered. The link is private, single-conversation,
        and expires automatically.
      </p>

      {lastLink ? (
        <div className="cx-link">
          <code>{lastLink}</code>
          <button
            type="button"
            className="btn btn-ghost cx-btn-sm"
            onClick={() => void copy(lastLink)}
          >
            Copy
          </button>
        </div>
      ) : null}

      {open ? (
        <div className="ov">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-title"
            className="dialog"
          >
            <h2 id="invite-title">Invite {conversation.visitorName} to live chat</h2>
            <p className="d">
              They will receive one email with a private link. No account needed.
            </p>
            <label className="label" htmlFor="invite-note" style={{ marginTop: 16 }}>
              Personal note (optional)
            </label>
            <textarea
              id="invite-note"
              className="field"
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="I'd be happy to talk this through live…"
            />
            <label className="pubrow" style={{ marginTop: 12, justifyContent: "space-between" }}>
              Email it to {conversation.visitorEmail}
              <Toggle
                checked={sendEmail}
                onChange={setSendEmail}
                label="Email the invite"
              />
            </label>
            <div className="a">
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void send(false)}
                disabled={createState.isLoading}
              >
                {createState.isLoading ? "Sending…" : "Create invite"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmRevoke}
        title="Revoke this invite?"
        description="The visitor is disconnected immediately and the old link stops working."
        confirmLabel="Revoke invite"
        busy={revokeState.isLoading}
        onClose={() => setConfirmRevoke(false)}
        onConfirm={() => {
          void revokeInvite(conversation.id)
            .unwrap()
            .then(() => {
              setConfirmRevoke(false);
              setLastLink(null);
              toast.success("Invite revoked");
            })
            .catch((error: unknown) => toast.error(errorMessage(error)));
        }}
      />
    </div>
  );
};

const VisitorPanel = ({ conversation }: { conversation: Conversation }) => {
  const [update, updateState] = useUpdateConversationMutation();
  const [remove, removeState] = useDeleteConversationMutation();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const patch = (data: Partial<Pick<Conversation, "status" | "starred" | "isSpam">>) =>
    update({ id: conversation.id, patch: data })
      .unwrap()
      .catch((error: unknown) => toast.error(errorMessage(error)));

  const inactive = conversation.status === "closed" || conversation.status === "archived";

  return (
    <div className="cx-side">
      <div className="cx-who">
        <div className="cx-avatar lg">{conversation.visitorName.slice(0, 1).toUpperCase()}</div>
        <div style={{ minWidth: 0 }}>
          <b>{conversation.visitorName}</b>
          <a href={`mailto:${conversation.visitorEmail}`}>{conversation.visitorEmail}</a>
        </div>
      </div>

      <dl className="cx-facts">
        <div>
          <dt>Subject</dt>
          <dd>{conversation.subject ?? "—"}</dd>
        </div>
        <div>
          <dt>First contact</dt>
          <dd>{formatDate(conversation.createdAt)}</dd>
        </div>
        <div>
          <dt>Last activity</dt>
          <dd>{relativeTime(conversation.lastMessageAt)}</dd>
        </div>
      </dl>

      <div className="cx-actions">
        <button
          type="button"
          className={cn("cx-action", conversation.starred && "on")}
          onClick={() => void patch({ starred: !conversation.starred })}
          disabled={updateState.isLoading}
        >
          <Star size={15} />
          {conversation.starred ? "Remove star" : "Star conversation"}
        </button>
        <button
          type="button"
          className="cx-action"
          onClick={() => void patch({ isSpam: !conversation.isSpam })}
          disabled={updateState.isLoading}
        >
          <ShieldAlert size={15} />
          {conversation.isSpam ? "Not spam" : "Mark as spam"}
        </button>
        <button
          type="button"
          className="cx-action"
          onClick={() => void patch({ status: inactive ? "open" : "closed" })}
          disabled={updateState.isLoading}
        >
          <MessageCircle size={15} />
          {inactive ? "Reopen conversation" : "Close conversation"}
        </button>
        <button
          type="button"
          className="cx-action"
          onClick={() =>
            void patch({
              status: conversation.status === "archived" ? "open" : "archived",
            })
          }
          disabled={updateState.isLoading}
        >
          <Archive size={15} />
          {conversation.status === "archived"
            ? "Restore from archive"
            : "Archive conversation"}
        </button>
        <button type="button" className="cx-action bad" onClick={() => setConfirmDelete(true)}>
          <Trash2 size={15} /> Delete conversation
        </button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this conversation?"
        description="Every message in the thread is deleted. The contact-form record is kept separately."
        busy={removeState.isLoading}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => {
          void remove(conversation.id)
            .unwrap()
            .then(() => {
              setConfirmDelete(false);
              toast.success("Conversation deleted");
            })
            .catch((error: unknown) => toast.error(errorMessage(error)));
        }}
      />
    </div>
  );
};

export const Thread = ({
  conversationId,
  onBack,
}: {
  conversationId: string;
  onBack: () => void;
}) => {
  // Without a live socket the thread falls back to polling, so a message that
  // arrives while the admin is reading the conversation still shows up.
  const connection = useAppSelector((state) => state.realtime.connection);
  const pollMs = connection === "live" ? 0 : 4_000;
  const conversation = useGetConversationQuery(conversationId, {
    pollingInterval: pollMs,
  });
  const messages = useGetMessagesQuery(
    { id: conversationId },
    { pollingInterval: pollMs },
  );
  const [loadOlder] = useLazyGetMessagesQuery();
  const [sendRest] = useSendConversationMessageMutation();
  const [markRead] = useMarkConversationReadMutation();
  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [showJump, setShowJump] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const typing = useAppSelector(
    (state) => state.realtime.typingByConversation[conversationId] ?? false,
  );
  const presence = useAppSelector(
    (state) => state.realtime.presenceByConversation[conversationId],
  );
  const scroller = useRef<HTMLDivElement>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const typingTimer = useRef<number | null>(null);
  const attachInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    // The component is keyed by conversationId, so local state starts fresh.
    joinConversation(conversationId);
    return () => leaveConversation(conversationId);
  }, [conversationId]);

  const all = [...older, ...(messages.data?.data ?? [])];

  const newestSeq = messages.data?.meta.newestSeq ?? 0;
  useEffect(() => {
    if (newestSeq > 0) {
      void markRead(conversationId);
      emitSeen(conversationId, newestSeq);
    }
    // Only a new high-water mark should trigger a read receipt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, newestSeq]);

  useEffect(() => {
    if (atBottom.current) bottom.current?.scrollIntoView({ block: "end" });
  }, [all.length, pending.length, typing]);

  const onScroll = (): void => {
    const element = scroller.current;
    if (!element) return;
    atBottom.current =
      element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    setShowJump(!atBottom.current);
  };

  const olderThan = older[0]?.seq ?? messages.data?.data[0]?.seq;

  const load = useCallback(async () => {
    if (!olderThan || loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    try {
      const page = await loadOlder({ id: conversationId, before: olderThan }).unwrap();
      setOlder((current) => [...page.data, ...current]);
      setHasMore(page.meta.hasMore);
    } catch (error) {
      toast.error(errorMessage(error, "Could not load older messages."));
    } finally {
      setLoadingOlder(false);
    }
  }, [conversationId, hasMore, loadOlder, loadingOlder, olderThan]);

  const deliver = async (item: PendingMessage): Promise<void> => {
    setPending((current) =>
      current.map((entry) =>
        entry.clientMsgId === item.clientMsgId ? { ...entry, status: "sending" } : entry,
      ),
    );
    if (isLive()) {
      const result = await emitMessage(conversationId, item.clientMsgId, item.body);
      if (result.ok) {
        setPending((current) =>
          current.filter((entry) => entry.clientMsgId !== item.clientMsgId),
        );
        return;
      }
    }
    try {
      await sendRest({
        id: conversationId,
        clientMsgId: item.clientMsgId,
        body: item.body,
      }).unwrap();
      setPending((current) =>
        current.filter((entry) => entry.clientMsgId !== item.clientMsgId),
      );
    } catch (error) {
      setPending((current) =>
        current.map((entry) =>
          entry.clientMsgId === item.clientMsgId
            ? { ...entry, status: "failed" }
            : entry,
        ),
      );
      toast.error(errorMessage(error, "Message failed to send."));
    }
  };

  const send = (): void => {
    const body = draft.trim();
    if (!body || !conversation.data) return;
    const item: PendingMessage = {
      clientMsgId: crypto.randomUUID(),
      body,
      status: "sending",
    };
    setPending((current) => [...current, item]);
    setDraft("");
    atBottom.current = true;
    emitTyping(conversationId, false);
    void deliver(item);
  };

  /** Upload to Cloudinary, then post the message that references the file. */
  const attach = async (file: File): Promise<void> => {
    setUploading(true);
    try {
      const uploaded = await uploadChatAttachment(conversationId, file);
      await sendRest({
        id: conversationId,
        clientMsgId: crypto.randomUUID(),
        body: "",
        imageKey: uploaded.key,
        imageMimeType: uploaded.mimeType,
        attachmentName: uploaded.name,
      }).unwrap();
    } catch (error) {
      toast.error(errorMessage(error, "The attachment could not be sent."));
    } finally {
      setUploading(false);
      if (attachInput.current) attachInput.current.value = "";
    }
  };

  const onDraft = (value: string): void => {
    setDraft(value);
    emitTyping(conversationId, true);
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      emitTyping(conversationId, false);
    }, 1_200);
  };

  if (conversation.isLoading)
    return (
      <div className="cx-panel">
        <LoadingList rows={5} />
      </div>
    );
  if (conversation.error)
    return (
      <div className="cx-panel">
        <ErrorState error={conversation.error} onRetry={conversation.refetch} />
      </div>
    );
  if (!conversation.data) return null;

  const data = conversation.data;
  const closed = data.status === "closed";
  const online = Boolean(presence?.visitorOnline);

  return (
    <div className="cx-panel">
      <div className="cx-head">
        <span className="lg:hidden">
          <button type="button" className="btn btn-ghost cx-btn-sm" onClick={onBack}>
            Back
          </button>
        </span>
        <div className={cn("cx-avatar", online && "hot")}>
          {data.visitorName.slice(0, 1).toUpperCase()}
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2>{data.visitorName}</h2>
            <span className={cn("cx-presence", online && "on")}>
              <i /> {online ? "online" : "offline"}
            </span>
          </div>
          <small>
            {data.subject ?? "No subject"} · {data.visitorEmail}
          </small>
        </div>
        <span className="lg:hidden">
          <button
            type="button"
            className="cx-iconbtn"
            onClick={() => setShowDetails((value) => !value)}
            aria-label="Conversation details"
            aria-pressed={showDetails}
          >
            <Info size={15} />
          </button>
        </span>
      </div>

      {showDetails ? (
        <div className="cx-details lg:hidden">
          <VisitorPanel conversation={data} />
        </div>
      ) : null}

      <InvitePanel conversation={data} />

      <div ref={scroller} onScroll={onScroll} className="cx-msgs">
        {hasMore ? (
          <div className="cx-more">
            <button
              type="button"
              className="btn btn-ghost cx-btn-sm"
              onClick={() => void load()}
              disabled={loadingOlder}
            >
              {loadingOlder ? "Loading…" : "Load earlier messages"}
            </button>
          </div>
        ) : null}

        {messages.isLoading ? <LoadingList rows={4} /> : null}

        {all.map((message, index) => {
          const previous = all[index - 1];
          const newDay =
            !previous ||
            new Date(previous.createdAt).toDateString() !==
              new Date(message.createdAt).toDateString();
          const mine = message.sender === "admin";
          return (
            <div key={message.id}>
              {newDay ? (
                <div className="cx-day">
                  <span>{formatDay(message.createdAt)}</span>
                </div>
              ) : null}
              <div className={cn("cx-line", mine && "mine")}>
                <div className="cx-msg">
                  {!mine && index === 0 ? (
                    <div className="cx-from">Sent via contact form</div>
                  ) : null}
                  <div className={cn("cx-bubble", mine && "mine")}>
                    {message.imageUrl && isImageMessage(message) ? (
                      <a
                        href={message.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cx-img"
                      >
                        <img
                          src={message.imageUrl}
                          alt={message.attachmentName ?? "Image attachment"}
                          loading="lazy"
                        />
                      </a>
                    ) : null}
                    {message.imageUrl && !isImageMessage(message) ? (
                      <a
                        href={message.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="cx-file"
                      >
                        <FileText size={15} style={{ flex: "none" }} />
                        <span>{message.attachmentName ?? "Document"}</span>
                      </a>
                    ) : null}
                    {message.body ? <div className="cx-text">{message.body}</div> : null}
                  </div>
                  <div className="cx-time">
                    {formatDate(message.createdAt)}
                    {mine ? <Ticks message={message} /> : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {pending.map((item) => (
          <div key={item.clientMsgId} className="cx-line mine">
            <div className="cx-msg">
              <div
                className={cn(
                  "cx-bubble mine",
                  item.status === "failed" ? "failed" : "pending",
                )}
              >
                <div className="cx-text">{item.body}</div>
              </div>
              <div className="cx-time">
                {item.status === "sending" ? "sending…" : "failed"}
                {item.status === "failed" ? (
                  <button type="button" className="cx-retry" onClick={() => void deliver(item)}>
                    <RotateCcw size={10} /> Retry
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}

        {typing ? (
          <div className="cx-typing">
            <span className="dots">
              <i />
              <i />
              <i />
            </span>
            <span>visitor is typing</span>
          </div>
        ) : null}

        <div ref={bottom} />
      </div>

      {showJump ? (
        <div className="cx-jump-wrap">
          <button
            type="button"
            className="cx-jump"
            onClick={() => {
              atBottom.current = true;
              setShowJump(false);
              bottom.current?.scrollIntoView({ behavior: "smooth" });
            }}
          >
            <ArrowDown size={12} /> Jump to latest
          </button>
        </div>
      ) : null}

      <div className="cx-composer">
        <div className="cx-composer-row">
          <input
            ref={attachInput}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif,application/pdf"
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void attach(file);
            }}
          />
          <button
            type="button"
            className="cx-iconbtn"
            style={{ width: 44, height: 44 }}
            onClick={() => attachInput.current?.click()}
            disabled={closed || uploading}
            aria-label="Attach an image or PDF"
            title="Attach an image or PDF (max 5 MB)"
          >
            {uploading ? <Loader2 size={16} className="animate-spin" /> : <Paperclip size={16} />}
          </button>
          <textarea
            className="cx-input"
            rows={1}
            value={draft}
            maxLength={2000}
            disabled={closed}
            placeholder={
              closed ? "This conversation is closed — reopen it to reply." : "Write a reply…"
            }
            onChange={(event) => onDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send();
              }
            }}
            aria-label="Message"
          />
          <button
            type="button"
            className="cx-send"
            onClick={send}
            disabled={closed || !draft.trim()}
            aria-label="Send message"
          >
            <Send size={17} />
          </button>
        </div>
        <div className="cx-hint">
          <span>Enter to send · Shift+Enter for a new line</span>
          <span>{draft.length}/2000</span>
        </div>
      </div>
    </div>
  );
};

export const ThreadActions = ({ conversation }: { conversation: Conversation }) => (
  <VisitorPanel conversation={conversation} />
);