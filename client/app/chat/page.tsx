import ChatScreen from "@/components/chat/ChatScreen";
import { ChatStoreProvider } from "@/lib/chat/ChatStoreProvider";

export default function ChatPage() {
  return (
    <ChatStoreProvider>
      <ChatScreen />
    </ChatStoreProvider>
  );
}
