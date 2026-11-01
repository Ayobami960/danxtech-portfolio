import { MessagesSquare } from "lucide-react";
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useGetConversationQuery } from "../../api/adminApi";
import { useAppDispatch } from "../../store/hooks";
import { EmptyState } from "../../components/States";
import { selectConversation } from "../ui/uiSlice";
import { ConversationList } from "./ConversationList";
import { Thread, ThreadActions } from "./Thread";
import "../../style/inbox.css";

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
    <div className="cx-shell">
      <div
        className={`${conversationId ? "hidden" : "block"} w-full shrink-0 lg:block lg:w-[340px]`}
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
          <div className="cx-panel items-center justify-center p-8">
            <EmptyState
              title="Select a conversation"
              description="Live chat and contact-form messages appear here in real time."
              icon={<MessagesSquare size={28} />}
            />
          </div>
        )}
      </div>

      {conversationId && conversation.data ? (
        <aside className="hidden w-[280px] shrink-0 xl:block">
          <div className="cx-panel cx-scroll">
            <ThreadActions conversation={conversation.data} />
          </div>
        </aside>
      ) : null}
    </div>
  );
}