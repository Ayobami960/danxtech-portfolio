import { useDispatch, useSelector } from "react-redux";
import type { ChatDispatch, ChatRootState } from "./store";

export const useChatDispatch = useDispatch.withTypes<ChatDispatch>();
export const useChatSelector = useSelector.withTypes<ChatRootState>();
