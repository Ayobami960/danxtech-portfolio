import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export type InboxView =
  | "all"
  | "new"
  | "open"
  | "closed"
  | "archived"
  | "starred"
  | "spam"
  | "unread";

export type UiState = {
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;
  inbox: { view: InboxView; q: string; page: number };
  selectedConversationId: string | null;
  projectPage: number;
};

const initialState: UiState = {
  sidebarOpen: false,
  sidebarCollapsed: false,
  inbox: { view: "all", q: "", page: 1 },
  selectedConversationId: null,
  projectPage: 1,
};

const uiSlice = createSlice({
  name: "ui",
  initialState,
  reducers: {
    toggleSidebar(state) {
      state.sidebarOpen = !state.sidebarOpen;
    },
    closeSidebar(state) {
      state.sidebarOpen = false;
    },
    toggleSidebarCollapsed(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setInboxView(state, action: PayloadAction<InboxView>) {
      state.inbox.view = action.payload;
      state.inbox.page = 1;
    },
    setInboxSearch(state, action: PayloadAction<string>) {
      state.inbox.q = action.payload;
      state.inbox.page = 1;
    },
    setInboxPage(state, action: PayloadAction<number>) {
      state.inbox.page = action.payload;
    },
    selectConversation(state, action: PayloadAction<string | null>) {
      state.selectedConversationId = action.payload;
    },
    setProjectPage(state, action: PayloadAction<number>) {
      state.projectPage = action.payload;
    },
    resetUi() {
      return initialState;
    },
  },
});

export const {
  toggleSidebar,
  closeSidebar,
  toggleSidebarCollapsed,
  setInboxView,
  setInboxSearch,
  setInboxPage,
  selectConversation,
  setProjectPage,
  resetUi,
} = uiSlice.actions;

export default uiSlice.reducer;
