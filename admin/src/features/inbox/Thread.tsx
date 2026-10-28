import {
  Archive,
  ArrowDown,
  Check,
  CheckCheck,
  Copy,
  Mail,
  MessageCircle,
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
import { useAppSelector } from "../../app/hooks";
import { ConfirmDialog } from "../../components/ConfirmDialog";
import { ErrorState, LoadingList } from "../../components/States";
import { Toggle } from "../../components/Fields";
import { cn } from "../../lib/cn";
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

const Ticks = ({ message }: { message: ChatMessage }) => {
  if (message.readAt) {
    return <CheckCheck size={13} className="text-[#93c5fd]" aria-label="Read" />;
  }
  if (message.deliveredAt) {
    return <CheckCheck size={13} className="text-[#7c8fa6]" aria-label="Delivered" />;
  }
  return <Check size={13} className="text-[#5f7189]" aria-label="Sent" />;
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

  return (
    <div className="border-b border-white/5 bg-[#0e1528]/60 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wide text-[#7c8fa6]">
          <Ticket size={13} /> Chat invite
        </span>
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase",
            status === "active"
              ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
              : status === "revoked"
                ? "border-red-400/30 bg-red-400/10 text-red-300"
                : status === "expired"
                  ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
                  : "border-white/10 bg-white/5 text-[#7c8fa6]",
          )}
        >
          {status === "none" ? "Not invited" : status}
        </span>
        {conversation.invite.expiresAt && status === "active" ? (
          <span className="text-[11px] text-[#5f7189]">
            expires {formatDate(conversation.invite.expiresAt)}
          </span>
        ) : null}
        <span
          className={cn(
            "flex items-center gap-1 font-mono text-[10px]",
            conversation.visitorVerifiedAt ? "text-emerald-300" : "text-[#5f7189]",
          )}
          title={
            conversation.visitorVerifiedAt
              ? `Verified ${formatDate(conversation.visitorVerifiedAt)}`
              : "The visitor has not verified their email yet"
          }
        >
          <ShieldAlert size={11} />
          {conversation.visitorVerifiedAt ? "visitor verified" : "not verified"}
        </span>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {status === "none" || status === "expired" ? (
            <button
              type="button"
              className="btn btn-primary !px-2.5 !py-1.5 text-xs"
              onClick={() => setOpen(true)}
            >
              <Mail size={13} /> Send chat invite
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-ghost !px-2.5 !py-1.5 text-xs"
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
                className="btn btn-ghost !px-2.5 !py-1.5 text-xs"
                onClick={() => void send(true)}
                disabled={resendState.isLoading}
              >
                <RotateCcw size={13} /> Resend
              </button>
              {status === "active" ? (
                <button
                  type="button"
                  className="btn btn-danger !px-2.5 !py-1.5 text-xs"
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

      <p className="mt-1.5 text-[11px] text-[#5f7189]">
        Only sent to the email the visitor entered. The link is private, single-conversation,
        and expires automatically.
      </p>

      {lastLink ? (
        <div className="mt-2 flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 p-2">
          <code className="min-w-0 flex-1 truncate font-mono text-[10px] text-[#9db0c6]">
            {lastLink}
          </code>
          <button
            type="button"
            className="btn btn-ghost !px-2 !py-1 text-[10px]"
            onClick={() => void copy(lastLink)}
          >
            Copy
          </button>
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="invite-title"
            className="window-card w-full max-w-md p-6"
          >
            <h2 id="invite-title" className="font-grotesk text-lg font-semibold text-white">
              Invite {conversation.visitorName} to live chat
            </h2>
            <p className="mt-1 text-sm text-[#7c8fa6]">
              They will receive one email with a private link. No account needed.
            </p>
            <label className="label mt-4" htmlFor="invite-note">
              Personal note (optional)
            </label>
            <textarea
              id="invite-note"
              className="field min-h-24"
              maxLength={500}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="I'd be happy to talk this through live…"
            />
            <label className="mt-3 flex items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-sm text-[#cbd8e8]">
              Email it to {conversation.visitorEmail}
              <Toggle
                checked={sendEmail}
                onChange={setSendEmail}
                label="Email the invite"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
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

  return (
    <div className="p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#3b82f6]/15 font-grotesk text-lg font-bold text-[#93c5fd]">
          {conversation.visitorName.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="truncate font-grotesk font-semibold text-white">
            {conversation.visitorName}
          </div>
          <a
            href={`mailto:${conversation.visitorEmail}`}
            className="block truncate text-xs text-[#3b82f6] hover:underline"
          >
            {conversation.visitorEmail}
          </a>
        </div>
      </div>

      <dl className="mt-4 space-y-2 text-xs">
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-wide text-[#5f7189]">
            Subject
          </dt>
          <dd className="text-[#cbd8e8]">{conversation.subject ?? "—"}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-wide text-[#5f7189]">
            First contact
          </dt>
          <dd className="text-[#cbd8e8]">{formatDate(conversation.createdAt)}</dd>
        </div>
        <div>
          <dt className="font-mono text-[10px] uppercase tracking-wide text-[#5f7189]">
            Last activity
          </dt>
          <dd className="text-[#cbd8e8]">{relativeTime(conversation.lastMessageAt)}</dd>
        </div>
      </dl>

      <div className="mt-5 space-y-1 border-t border-white/5 pt-3">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-[#cbd8e8] hover:bg-white/5"
          onClick={() => void patch({ starred: !conversation.starred })}
          disabled={updateState.isLoading}
        >
          <Star
            size={15}
            className={conversation.starred ? "text-[#f0a500]" : "text-[#7c8fa6]"}
          />
          {conversation.starred ? "Remove star" : "Star conversation"}
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-[#cbd8e8] hover:bg-white/5"
          onClick={() => void patch({ isSpam: !conversation.isSpam })}
          disabled={updateState.isLoading}
        >
          <ShieldAlert size={15} className="text-[#7c8fa6]" />
          {conversation.isSpam ? "Not spam" : "Mark as spam"}
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-[#cbd8e8] hover:bg-white/5"
          onClick={() =>
            void patch({
              status:
                conversation.status === "closed" || conversation.status === "archived"
                  ? "open"
                  : "closed",
            })
          }
          disabled={updateState.isLoading}
        >
          <MessageCircle size={15} className="text-[#7c8fa6]" />
          {conversation.status === "closed" || conversation.status === "archived"
            ? "Reopen conversation"
            : "Close conversation"}
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-[#cbd8e8] hover:bg-white/5"
          onClick={() =>
            void patch({
              status: conversation.status === "archived" ? "open" : "archived",
            })
          }
          disabled={updateState.isLoading}
        >
          <Archive size={15} className="text-[#7c8fa6]" />
          {conversation.status === "archived"
            ? "Restore from archive"
            : "Archive conversation"}
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-red-300 hover:bg-red-500/10"
          onClick={() => setConfirmDelete(true)}
        >
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
  const conversation = useGetConversationQuery(conversationId);
  const messages = useGetMessagesQuery({ id: conversationId });
  const [loadOlder] = useLazyGetMessagesQuery();
  const [sendRest] = useSendConversationMessageMutation();
  const [markRead] = useMarkConversationReadMutation();
  const [older, setOlder] = useState<ChatMessage[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [showJump, setShowJump] = useState(false);
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

  const onDraft = (value: string): void => {
    setDraft(value);
    emitTyping(conversationId, true);
    if (typingTimer.current) window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => {
      emitTyping(conversationId, false);
    }, 1_200);
  };

  if (conversation.isLoading) return <LoadingList rows={5} />;
  if (conversation.error)
    return <ErrorState error={conversation.error} onRetry={conversation.refetch} />;
  if (!conversation.data) return null;

  const data = conversation.data;
  const closed = data.status === "closed";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-white/5 px-4 py-3">
        <button
          type="button"
          className="btn btn-ghost !px-2 !py-1 text-xs lg:hidden"
          onClick={onBack}
        >
          Back
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="truncate font-grotesk font-semibold text-white">
              {data.visitorName}
            </h2>
            {presence?.visitorOnline ? (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> online
              </span>
            ) : (
              <span className="font-mono text-[10px] text-[#5f7189]">offline</span>
            )}
          </div>
          <div className="truncate text-xs text-[#7c8fa6]">
            {data.subject ?? "No subject"} · {data.visitorEmail}
          </div>
        </div>
      </div>

      <InvitePanel conversation={data} />

      <div
        ref={scroller}
        onScroll={onScroll}
        className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-4"
      >
        {hasMore ? (
          <div className="pb-2 text-center">
            <button
              type="button"
              className="btn btn-ghost !py-1 text-[11px]"
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
                <div className="my-4 flex items-center gap-3">
                  <span className="h-px flex-1 bg-white/5" />
                  <span className="font-mono text-[10px] text-[#5f7189]">
                    {formatDay(message.createdAt)}
                  </span>
                  <span className="h-px flex-1 bg-white/5" />
                </div>
              ) : null}
              <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div className="max-w-[82%]">
                  {!mine && index === 0 ? (
                    <div className="mb-1 font-mono text-[9px] uppercase tracking-wide text-[#5f7189]">
                      Sent via contact form
                    </div>
                  ) : null}
                  <div
                    className={cn(
                      "overflow-hidden rounded-2xl text-sm",
                      mine
                        ? "rounded-br-md bg-[#3b82f6] text-white"
                        : "rounded-bl-md border border-white/8 bg-[#131c35] text-[#e6edf7]",
                    )}
                  >
                    {message.imageUrl ? (
                      <a
                        href={message.imageUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <img
                          src={message.imageUrl}
                          alt="Image attachment"
                          loading="lazy"
                          className="max-h-64 w-full object-cover"
                        />
                      </a>
                    ) : null}
                    {message.body ? (
                      <div className="whitespace-pre-wrap break-words px-3.5 py-2.5">
                        {message.body}
                      </div>
                    ) : null}
                  </div>
                  <div
                    className={cn(
                      "mt-1 flex items-center gap-1 font-mono text-[9px] text-[#5f7189]",
                      mine ? "justify-end" : "justify-start",
                    )}
                  >
                    {formatDate(message.createdAt)}
                    {mine ? <Ticks message={message} /> : null}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {pending.map((item) => (
          <div key={item.clientMsgId} className="flex justify-end">
            <div className="max-w-[82%]">
              <div
                className={cn(
                  "whitespace-pre-wrap break-words rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm",
                  item.status === "failed"
                    ? "border border-red-400/30 bg-red-500/15 text-red-100"
                    : "bg-[#3b82f6]/60 text-white",
                )}
              >
                {item.body}
              </div>
              <div className="mt-1 flex items-center justify-end gap-2 font-mono text-[9px] text-[#5f7189]">
                {item.status === "sending" ? "sending…" : "failed"}
                {item.status === "failed" ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 text-red-300 hover:underline"
                    onClick={() => void deliver(item)}
                  >
                    <RotateCcw size={10} /> Retry
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}

        {typing ? (
          <div className="flex items-center gap-2 pt-1 text-[#7c8fa6]">
            <span className="flex gap-1 rounded-full border border-white/10 bg-[#131c35] px-3 py-2">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#7c8fa6]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#7c8fa6] [animation-delay:120ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#7c8fa6] [animation-delay:240ms]" />
            </span>
            <span className="text-[10px]">visitor is typing</span>
          </div>
        ) : null}

        <div ref={bottom} />
      </div>

      {showJump ? (
        <div className="relative">
          <button
            type="button"
            className="absolute -top-12 right-4 inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#131c35] px-3 py-1.5 text-[11px] text-[#cbd8e8] shadow-lg"
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

      <div className="border-t border-white/5 p-3">
        <div className="flex items-end gap-2">
          <textarea
            className="field max-h-40 min-h-11 flex-1 resize-y py-2.5"
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
            className="btn btn-primary h-11"
            onClick={send}
            disabled={closed || !draft.trim()}
          >
            <Send size={15} /> Send
          </button>
        </div>
        <div className="mt-1 flex justify-between font-mono text-[10px] text-[#5f7189]">
          <span>Enter to send · Shift+Enter for a new line</span>
          <span>{draft.length}/2000</span>
        </div>
      </div>

      <div className="lg:hidden">
        <VisitorPanel conversation={data} />
      </div>
    </div>
  );
};

export const ThreadActions = ({ conversation }: { conversation: Conversation }) => (
  <VisitorPanel conversation={conversation} />
);
