import { MessagesSquare } from "lucide-react";
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGetConversationQuery } from "../../api/adminApi";
import { useAppDispatch } from "../../app/hooks";
import { EmptyState } from "../../components/States";
import { selectConversation } from "../ui/uiSlice";
import { ConversationList } from "./ConversationList";
import { Thread, ThreadActions } from "./Thread";

export default function InboxPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const conversation = useGetConversationQuery(conversationId ?? "", {
    skip: !conversationId,
  });

  useEffect(() => {
    dispatch(selectConversation(conversationId ?? null));
  }, [conversationId, dispatch]);

  return (
    <div className="window-card -mx-1 flex h-[calc(100vh-11rem)] min-h-[520px] overflow-hidden">
      <div
        className={`${conversationId ? "hidden" : "block"} w-full shrink-0 border-r border-white/5 lg:block lg:w-[340px]`}
      >
        <ConversationList
          selectedId={conversationId ?? null}
          onSelect={(item) => navigate(`/inbox/${item.id}`)}
        />
      </div>

      <div
        className={`min-w-0 flex-1 ${conversationId ? "block" : "hidden lg:block"}`}
      >
        {conversationId ? (
          <Thread
            key={conversationId}
            conversationId={conversationId}
            onBack={() => navigate("/inbox")}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8">
            <EmptyState
              title="Select a conversation"
              description="Live chat and contact-form messages appear here in real time."
              icon={<MessagesSquare size={28} />}
            />
          </div>
        )}
      </div>

      {conversationId && conversation.data ? (
        <aside className="hidden w-[280px] shrink-0 overflow-y-auto border-l border-white/5 xl:block">
          <ThreadActions conversation={conversation.data} />
        </aside>
      ) : null}
    </div>
  );
}
