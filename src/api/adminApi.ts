import { createApi } from "@reduxjs/toolkit/query/react";
import { baseQueryWithReauth } from "./baseQuery";
import { applyOrder, replaceEntity } from "./optimistic";
import type {
  About,
  AuditEntry,
  ChatMessage,
  Conversation,
  Credential,
  Experience,
  Hero,
  InviteResult,
  MessagePage,
  OwaspItem,
  Paginated,
  Project,
  ProjectInput,
  ResumeInfo,
  SecurityFocus,
  SecurityStat,
  SessionInfo,
  Settings,
  SkillGroup,
  Stats,
  TwoFactorStatus,
} from "./types";
import { onRealtime } from "../realtime/socket";

export type ConversationFilters = {
  status?: "new" | "open" | "closed" | "archived";
  starred?: boolean;
  isSpam?: boolean;
  unread?: boolean;
  q?: string;
};

type ListArgs = { page: number; pageSize: number };

const messageUrl = (id: string, before?: number): string =>
  `/admin/conversations/${id}/messages${before ? `?before=${before}&limit=50` : "?limit=50"}`;

export const adminApi = createApi({
  reducerPath: "adminApi",
  baseQuery: baseQueryWithReauth,
  keepUnusedDataFor: 120,
  tagTypes: [
    "Hero",
    "About",
    "Project",
    "ProjectImage",
    "Conversation",
    "ConversationMessages",
    "ConversationCount",
    "Resume",
    "Skill",
    "Experience",
    "SecurityFocus",
    "Owasp",
    "SecurityStat",
    "Credential",
    "Settings",
    "Stats",
    "Activity",
    "Session",
  ],
  endpoints: (build) => ({
    /* --------------------------------- dashboard -------------------------------- */
    getStats: build.query<Stats, void>({
      query: () => "/admin/stats",
      providesTags: ["Stats"],
    }),
    getActivity: build.query<
      Paginated<AuditEntry>,
      { page: number; pageSize: number; entity?: string }
    >({
      query: ({ page, pageSize, entity }) => ({
        url: "/admin/activity",
        params: {
          page,
          pageSize,
          ...(entity ? { entity } : {}),
        },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({ type: "Activity" as const, id })),
              { type: "Activity" as const, id: "LIST" },
            ]
          : [{ type: "Activity" as const, id: "LIST" }],
    }),

    /* ----------------------------------- hero ----------------------------------- */
    getHero: build.query<Hero, void>({
      query: () => "/admin/hero",
      providesTags: ["Hero"],
    }),
    updateHero: build.mutation<Hero, Omit<Hero, "id" | "updatedAt">>({
      query: (body) => ({ url: "/admin/hero", method: "PUT", body }),
      invalidatesTags: ["Hero", "Stats"],
    }),

    /* ---------------------------------- about ----------------------------------- */
    getAbout: build.query<About, void>({
      query: () => "/admin/about",
      providesTags: ["About"],
    }),
    updateAbout: build.mutation<
      About,
      Pick<About, "paragraphs" | "tags" | "metrics" | "principles">
    >({
      query: (body) => ({ url: "/admin/about", method: "PUT", body }),
      invalidatesTags: ["About", "Stats"],
    }),

    /* -------------------------------- credentials -------------------------------- */
    getCredentials: build.query<Paginated<Credential>, ListArgs>({
      query: ({ page, pageSize }) => ({
        url: "/admin/credentials",
        params: { page, pageSize },
      }),
      providesTags: [{ type: "Credential", id: "LIST" }],
    }),
    createCredential: build.mutation<Credential, Omit<Credential, "id" | "sortOrder" | "createdAt" | "updatedAt">>({
      query: (body) => ({ url: "/admin/credentials", method: "POST", body }),
      invalidatesTags: [{ type: "Credential", id: "LIST" }, "Stats"],
    }),
    updateCredential: build.mutation<Credential, { id: string; patch: Partial<Credential> }>({
      query: ({ id, patch }) => ({
        url: `/admin/credentials/${id}`,
        method: "PATCH",
        body: patch,
      }),
      invalidatesTags: [{ type: "Credential", id: "LIST" }, "Stats"],
    }),
    deleteCredential: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/credentials/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Credential", id: "LIST" }, "Stats"],
    }),
    reorderCredentials: build.mutation<{ ok: true }, string[]>({
      query: (ids) => ({
        url: "/admin/credentials/reorder",
        method: "PATCH",
        body: { ids },
      }),
      async onQueryStarted(ids, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          adminApi.util.updateQueryData(
            "getCredentials",
            { page: 1, pageSize: 100 },
            (draft) => {
              draft.data = applyOrder(draft.data, ids);
            },
          ),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: [{ type: "Credential", id: "LIST" }],
    }),

    /* ---------------------------------- skills ----------------------------------- */
    getSkills: build.query<Paginated<SkillGroup>, ListArgs>({
      query: ({ page, pageSize }) => ({ url: "/admin/skills", params: { page, pageSize } }),
      providesTags: [{ type: "Skill", id: "LIST" }],
    }),
    createSkill: build.mutation<SkillGroup, { title: string; icon: string; items: string[] }>({
      query: (body) => ({ url: "/admin/skills", method: "POST", body }),
      invalidatesTags: [{ type: "Skill", id: "LIST" }, "Stats"],
    }),
    updateSkill: build.mutation<SkillGroup, { id: string; patch: Partial<SkillGroup> }>({
      query: ({ id, patch }) => ({ url: `/admin/skills/${id}`, method: "PATCH", body: patch }),
      invalidatesTags: [{ type: "Skill", id: "LIST" }, "Stats"],
    }),
    deleteSkill: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/skills/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Skill", id: "LIST" }, "Stats"],
    }),
    reorderSkills: build.mutation<{ ok: true }, string[]>({
      query: (ids) => ({ url: "/admin/skills/reorder", method: "PATCH", body: { ids } }),
      async onQueryStarted(ids, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          adminApi.util.updateQueryData("getSkills", { page: 1, pageSize: 100 }, (draft) => {
            draft.data = applyOrder(draft.data, ids);
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: [{ type: "Skill", id: "LIST" }],
    }),

    /* -------------------------------- experience --------------------------------- */
    getExperience: build.query<Paginated<Experience>, ListArgs>({
      query: ({ page, pageSize }) => ({ url: "/admin/experience", params: { page, pageSize } }),
      providesTags: [{ type: "Experience", id: "LIST" }],
    }),
    createExperience: build.mutation<Experience, Omit<Experience, "id" | "sortOrder" | "createdAt" | "updatedAt">>({
      query: (body) => ({ url: "/admin/experience", method: "POST", body }),
      invalidatesTags: [{ type: "Experience", id: "LIST" }, "Stats"],
    }),
    updateExperience: build.mutation<Experience, { id: string; patch: Partial<Experience> }>({
      query: ({ id, patch }) => ({ url: `/admin/experience/${id}`, method: "PATCH", body: patch }),
      invalidatesTags: [{ type: "Experience", id: "LIST" }, "Stats"],
    }),
    deleteExperience: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/experience/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Experience", id: "LIST" }, "Stats"],
    }),
    reorderExperience: build.mutation<{ ok: true }, string[]>({
      query: (ids) => ({ url: "/admin/experience/reorder", method: "PATCH", body: { ids } }),
      async onQueryStarted(ids, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          adminApi.util.updateQueryData(
            "getExperience",
            { page: 1, pageSize: 100 },
            (draft) => {
              draft.data = applyOrder(draft.data, ids);
            },
          ),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: [{ type: "Experience", id: "LIST" }],
    }),

    /* --------------------------------- security ---------------------------------- */
    getSecurityFocus: build.query<Paginated<SecurityFocus>, ListArgs>({
      query: ({ page, pageSize }) => ({ url: "/admin/security/focus", params: { page, pageSize } }),
      providesTags: [{ type: "SecurityFocus", id: "LIST" }],
    }),
    createSecurityFocus: build.mutation<SecurityFocus, Omit<SecurityFocus, "id" | "sortOrder" | "createdAt" | "updatedAt">>({
      query: (body) => ({ url: "/admin/security/focus", method: "POST", body }),
      invalidatesTags: [{ type: "SecurityFocus", id: "LIST" }, "Stats"],
    }),
    updateSecurityFocus: build.mutation<SecurityFocus, { id: string; patch: Partial<SecurityFocus> }>({
      query: ({ id, patch }) => ({ url: `/admin/security/focus/${id}`, method: "PATCH", body: patch }),
      invalidatesTags: [{ type: "SecurityFocus", id: "LIST" }, "Stats"],
    }),
    deleteSecurityFocus: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/security/focus/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "SecurityFocus", id: "LIST" }, "Stats"],
    }),
    reorderSecurityFocus: build.mutation<{ ok: true }, string[]>({
      query: (ids) => ({ url: "/admin/security/focus/reorder", method: "PATCH", body: { ids } }),
      invalidatesTags: [{ type: "SecurityFocus", id: "LIST" }],
    }),

    getOwasp: build.query<Paginated<OwaspItem>, ListArgs>({
      query: ({ page, pageSize }) => ({ url: "/admin/security/owasp", params: { page, pageSize } }),
      providesTags: [{ type: "Owasp", id: "LIST" }],
    }),
    createOwasp: build.mutation<OwaspItem, { code: string; name: string; covered: boolean }>({
      query: (body) => ({ url: "/admin/security/owasp", method: "POST", body }),
      invalidatesTags: [{ type: "Owasp", id: "LIST" }, "Stats"],
    }),
    updateOwasp: build.mutation<OwaspItem, { id: string; patch: Partial<OwaspItem> }>({
      query: ({ id, patch }) => ({ url: `/admin/security/owasp/${id}`, method: "PATCH", body: patch }),
      async onQueryStarted({ id, patch }, { dispatch, queryFulfilled }) {
        const local = dispatch(
          adminApi.util.updateQueryData("getOwasp", { page: 1, pageSize: 100 }, (draft) => {
            draft.data = draft.data.map((item) =>
              item.id === id ? { ...item, ...patch } : item,
            );
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          local.undo();
        }
      },
      invalidatesTags: [{ type: "Owasp", id: "LIST" }],
    }),
    deleteOwasp: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/security/owasp/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Owasp", id: "LIST" }, "Stats"],
    }),
    reorderOwasp: build.mutation<{ ok: true }, string[]>({
      query: (ids) => ({ url: "/admin/security/owasp/reorder", method: "PATCH", body: { ids } }),
      invalidatesTags: [{ type: "Owasp", id: "LIST" }],
    }),

    getSecurityStats: build.query<Paginated<SecurityStat>, ListArgs>({
      query: ({ page, pageSize }) => ({ url: "/admin/security/stats", params: { page, pageSize } }),
      providesTags: [{ type: "SecurityStat", id: "LIST" }],
    }),
    createSecurityStat: build.mutation<SecurityStat, { icon: string; label: string; value: string }>({
      query: (body) => ({ url: "/admin/security/stats", method: "POST", body }),
      invalidatesTags: [{ type: "SecurityStat", id: "LIST" }, "Stats"],
    }),
    updateSecurityStat: build.mutation<SecurityStat, { id: string; patch: Partial<SecurityStat> }>({
      query: ({ id, patch }) => ({ url: `/admin/security/stats/${id}`, method: "PATCH", body: patch }),
      invalidatesTags: [{ type: "SecurityStat", id: "LIST" }, "Stats"],
    }),
    deleteSecurityStat: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/security/stats/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "SecurityStat", id: "LIST" }, "Stats"],
    }),
    reorderSecurityStats: build.mutation<{ ok: true }, string[]>({
      query: (ids) => ({ url: "/admin/security/stats/reorder", method: "PATCH", body: { ids } }),
      invalidatesTags: [{ type: "SecurityStat", id: "LIST" }],
    }),

    /* --------------------------------- projects ---------------------------------- */
    getProjects: build.query<Paginated<Project>, ListArgs>({
      query: ({ page, pageSize }) => ({ url: "/admin/projects", params: { page, pageSize } }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({ type: "Project" as const, id })),
              { type: "Project" as const, id: "LIST" },
            ]
          : [{ type: "Project" as const, id: "LIST" }],
    }),
    getProject: build.query<Project, string>({
      query: (id) => `/admin/projects/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Project", id }],
    }),
    createProject: build.mutation<Project, ProjectInput>({
      query: (body) => ({ url: "/admin/projects", method: "POST", body }),
      invalidatesTags: [{ type: "Project", id: "LIST" }, "Stats"],
    }),
    updateProject: build.mutation<Project, { id: string; patch: Partial<ProjectInput> & { published?: boolean } }>({
      query: ({ id, patch }) => ({ url: `/admin/projects/${id}`, method: "PATCH", body: patch }),
      async onQueryStarted({ id, patch }, { dispatch, queryFulfilled }) {
        const listPatch = dispatch(
          adminApi.util.updateQueryData("getProjects", { page: 1, pageSize: 100 }, (draft) => {
            draft.data = draft.data.map((project) =>
              project.id === id ? { ...project, ...patch } : project,
            );
          }),
        );
        const detailPatch = dispatch(
          adminApi.util.updateQueryData("getProject", id, (draft) => {
            Object.assign(draft, patch);
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          listPatch.undo();
          detailPatch.undo();
        }
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Project", id },
        { type: "Project", id: "LIST" },
        "Stats",
      ],
    }),
    deleteProject: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/projects/${id}`, method: "DELETE" }),
      invalidatesTags: [{ type: "Project", id: "LIST" }, "Stats"],
    }),
    featureProject: build.mutation<Project, string>({
      query: (id) => ({ url: `/admin/projects/${id}/featured`, method: "PATCH" }),
      async onQueryStarted(id, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          adminApi.util.updateQueryData("getProjects", { page: 1, pageSize: 100 }, (draft) => {
            draft.data = draft.data.map((project) => ({
              ...project,
              featured: project.id === id,
            }));
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: [{ type: "Project", id: "LIST" }],
    }),
    reorderProjects: build.mutation<{ ok: true }, string[]>({
      query: (ids) => ({ url: "/admin/projects/reorder", method: "PATCH", body: { ids } }),
      async onQueryStarted(ids, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          adminApi.util.updateQueryData("getProjects", { page: 1, pageSize: 100 }, (draft) => {
            draft.data = applyOrder(draft.data, ids);
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: [{ type: "Project", id: "LIST" }],
    }),
    reorderGallery: build.mutation<Project, { id: string; ids: string[] }>({
      query: ({ id, ids }) => ({
        url: `/admin/projects/${id}/gallery/reorder`,
        method: "PATCH",
        body: { ids },
      }),
      async onQueryStarted({ id, ids }, { dispatch, queryFulfilled }) {
        const patch = dispatch(
          adminApi.util.updateQueryData("getProject", id, (draft) => {
            draft.gallery = applyOrder(draft.gallery, ids);
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          patch.undo();
        }
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Project", id },
        { type: "ProjectImage", id },
      ],
    }),
    deleteGalleryImage: build.mutation<Project, { id: string; imageId: string }>({
      query: ({ id, imageId }) => ({
        url: `/admin/projects/${id}/gallery/${imageId}`,
        method: "DELETE",
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Project", id },
        { type: "ProjectImage", id },
      ],
    }),

    /** Attach a cover the browser already uploaded to Cloudinary. */
    setProjectCover: build.mutation<
      Project,
      { id: string; url: string; publicId: string }
    >({
      query: ({ id, url, publicId }) => ({
        url: `/admin/projects/${id}/cover`,
        method: "POST",
        body: { url, publicId },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Project", id },
        { type: "Project", id: "LIST" },
      ],
    }),
    /** Attach gallery images the browser already uploaded to Cloudinary. */
    addProjectGallery: build.mutation<
      Project,
      { id: string; results: Array<{ url: string; publicId: string }> }
    >({
      query: ({ id, results }) => ({
        url: `/admin/projects/${id}/gallery`,
        method: "POST",
        body: { results },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Project", id },
        { type: "ProjectImage", id },
        { type: "Project", id: "LIST" },
      ],
    }),

    /* ---------------------------------- resume ----------------------------------- */
    getResume: build.query<ResumeInfo | null, void>({
      query: () => "/admin/resume",
      providesTags: ["Resume"],
    }),
    updateResume: build.mutation<ResumeInfo, { url: string; publicId: string }>({
      query: (body) => ({ url: "/admin/resume", method: "PUT", body }),
      invalidatesTags: ["Resume", "Stats"],
    }),
    deleteResume: build.mutation<void, void>({
      query: () => ({ url: "/admin/resume", method: "DELETE" }),
      invalidatesTags: ["Resume", "Stats"],
    }),

    /* -------------------------------- conversations ------------------------------ */
    getConversations: build.query<
      Paginated<Conversation>,
      ListArgs & ConversationFilters
    >({
      query: (args) => ({
        url: "/admin/conversations",
        params: {
          page: args.page,
          pageSize: args.pageSize,
          ...(args.status ? { status: args.status } : {}),
          ...(args.starred !== undefined ? { starred: args.starred } : {}),
          ...(args.isSpam !== undefined ? { isSpam: args.isSpam } : {}),
          ...(args.unread !== undefined ? { unread: args.unread } : {}),
          ...(args.q ? { q: args.q } : {}),
        },
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.data.map(({ id }) => ({ type: "Conversation" as const, id })),
              { type: "Conversation" as const, id: "LIST" },
            ]
          : [{ type: "Conversation" as const, id: "LIST" }],
      async onCacheEntryAdded(_args, { updateCachedData, cacheDataLoaded, cacheEntryRemoved, dispatch }) {
        await cacheDataLoaded;
        const cleanups = [
          onRealtime("conversation:new", (payload) => {
            const conversation = (payload as { conversation?: Conversation }).conversation;
            if (!conversation) return;
            updateCachedData((draft) => {
              if (!draft.data.some((item) => item.id === conversation.id)) {
                draft.data = [conversation, ...draft.data].sort(
                  (a, b) =>
                    new Date(b.lastMessageAt).getTime() -
                    new Date(a.lastMessageAt).getTime(),
                );
                draft.meta.total += 1;
              }
            });
            dispatch(adminApi.util.invalidateTags(["ConversationCount", "Stats"]));
          }),
          onRealtime("conversation:update", (payload) => {
            const data = payload as { id?: string; patch?: Partial<Conversation> & { deleted?: boolean } };
            if (!data.id) return;
            updateCachedData((draft) => {
              if (data.patch?.deleted) {
                draft.data = draft.data.filter((item) => item.id !== data.id);
                return;
              }
              draft.data = draft.data.map((item) =>
                item.id === data.id
                  ? {
                      ...item,
                      ...(data.patch ?? {}),
                      invite:
                        data.patch?.invite ?? item.invite,
                    }
                  : item,
              );
            });
          }),
          onRealtime("message:new", (payload) => {
            const cast = payload as { message?: ChatMessage; conversation?: Conversation };
            if (!cast.conversation) return;
            updateCachedData((draft) => {
              draft.data = draft.data
                .map((item) =>
                  item.id === cast.conversation?.id ? cast.conversation : item,
                )
                .sort(
                  (a, b) =>
                    new Date(b.lastMessageAt).getTime() -
                    new Date(a.lastMessageAt).getTime(),
                );
            });
            dispatch(adminApi.util.invalidateTags(["ConversationCount"]));
          }),
        ];
        await cacheEntryRemoved;
        for (const cleanup of cleanups) cleanup();
      },
    }),
    getUnreadConversations: build.query<{ unread: number }, void>({
      query: () => "/admin/conversations/unread-count",
      providesTags: ["ConversationCount"],
    }),
    getConversation: build.query<Conversation, string>({
      query: (id) => `/admin/conversations/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Conversation", id }],
    }),
    getMessages: build.query<MessagePage, { id: string; before?: number }>({
      query: ({ id, before }) => messageUrl(id, before),
      providesTags: (_result, _error, { id }) => [
        { type: "ConversationMessages", id },
      ],
      async onCacheEntryAdded({ id }, { updateCachedData, cacheDataLoaded, cacheEntryRemoved }) {
        await cacheDataLoaded;
        const offNew = onRealtime("message:new", (payload) => {
          const message = (payload as { message?: ChatMessage }).message;
          if (!message || message.conversationId !== id) return;
          updateCachedData((draft) => {
            if (draft.data.some((item) => item.id === message.id)) return;
            draft.data = [...draft.data, message];
            draft.meta.newestSeq = Math.max(draft.meta.newestSeq ?? 0, message.seq);
          });
        });
        const offStatus = onRealtime("message:status", (payload) => {
          const status = payload as {
            conversationId?: string;
            upToSeq?: number;
            readAt?: string | null;
          };
          if (status.conversationId !== id || typeof status.upToSeq !== "number") return;
          updateCachedData((draft) => {
            draft.data = draft.data.map((message) =>
              message.seq <= (status.upToSeq as number) && message.sender === "visitor"
                ? {
                    ...message,
                    deliveredAt: message.deliveredAt ?? status.readAt ?? null,
                    readAt: status.readAt ?? message.readAt,
                  }
                : message,
            );
          });
        });
        await cacheEntryRemoved;
        offNew();
        offStatus();
      },
    }),
    sendConversationMessage: build.mutation<
      ChatMessage,
      {
        id: string;
        clientMsgId: string;
        body: string;
        imageKey?: string;
        imageMimeType?: string;
        attachmentName?: string;
      }
    >({
      query: ({ id, clientMsgId, body, imageKey, imageMimeType, attachmentName }) => ({
        url: `/admin/conversations/${id}/messages`,
        method: "POST",
        body: {
          clientMsgId,
          body,
          ...(imageKey ? { imageKey } : {}),
          ...(imageMimeType ? { imageMimeType } : {}),
          ...(attachmentName ? { attachmentName } : {}),
        },
      }),
      invalidatesTags: (_result, _error, { id }) => [
        { type: "ConversationMessages", id },
        { type: "Conversation", id },
        { type: "Conversation", id: "LIST" },
        "ConversationCount",
      ],
    }),
    markConversationRead: build.mutation<{ upToSeq: number }, string>({
      query: (id) => ({ url: `/admin/conversations/${id}/read`, method: "POST" }),
      invalidatesTags: (_result, _error, id) => [
        { type: "Conversation", id },
        { type: "Conversation", id: "LIST" },
        "ConversationCount",
        "Stats",
      ],
    }),
    updateConversation: build.mutation<
      Conversation,
      { id: string; patch: Partial<Pick<Conversation, "status" | "starred" | "isSpam">> }
    >({
      query: ({ id, patch }) => ({
        url: `/admin/conversations/${id}`,
        method: "PATCH",
        body: patch,
      }),
      async onQueryStarted({ id, patch }, { dispatch, queryFulfilled }) {
        const listPatch = dispatch(
          adminApi.util.updateQueryData(
            "getConversations",
            { page: 1, pageSize: 100 },
            (draft) => {
              draft.data = replaceEntity(
                draft.data,
                { ...(draft.data.find((item) => item.id === id) as Conversation), ...patch },
              );
            },
          ),
        );
        const detailPatch = dispatch(
          adminApi.util.updateQueryData("getConversation", id, (draft) => {
            Object.assign(draft, patch);
          }),
        );
        try {
          await queryFulfilled;
        } catch {
          listPatch.undo();
          detailPatch.undo();
        }
      },
      invalidatesTags: (_result, _error, { id }) => [
        { type: "Conversation", id },
        { type: "Conversation", id: "LIST" },
        "Stats",
      ],
    }),
    deleteConversation: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/conversations/${id}`, method: "DELETE" }),
      invalidatesTags: [
        { type: "Conversation", id: "LIST" },
        "ConversationCount",
        "Stats",
      ],
    }),
    createInvite: build.mutation<
      InviteResult,
      { id: string; note?: string; sendEmail: boolean }
    >({
      query: ({ id, note, sendEmail }) => ({
        url: `/admin/conversations/${id}/invite`,
        method: "POST",
        body: { ...(note ? { note } : {}), sendEmail },
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "Conversation", id }],
    }),
    resendInvite: build.mutation<
      InviteResult,
      { id: string; note?: string; sendEmail: boolean }
    >({
      query: ({ id, note, sendEmail }) => ({
        url: `/admin/conversations/${id}/invite/resend`,
        method: "POST",
        body: { ...(note ? { note } : {}), sendEmail },
      }),
      invalidatesTags: (_result, _error, { id }) => [{ type: "Conversation", id }],
    }),
    revokeInvite: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/conversations/${id}/invite`, method: "DELETE" }),
      invalidatesTags: (_result, _error, id) => [{ type: "Conversation", id }],
    }),

    /* --------------------------------- settings ---------------------------------- */
    getSettings: build.query<Settings, void>({
      query: () => "/admin/settings",
      providesTags: ["Settings"],
    }),
    updateSettings: build.mutation<Settings, Pick<Settings, "contactEmail" | "phone" | "location">>({
      query: (body) => ({ url: "/admin/settings", method: "PUT", body }),
      invalidatesTags: ["Settings", "Stats"],
    }),

    /* ---------------------------------- account ---------------------------------- */
    getTwoFactor: build.query<TwoFactorStatus, void>({
      query: () => "/admin/account/2fa",
      providesTags: ["Session"],
    }),
    setupTwoFactor: build.mutation<{ otpauthUrl: string; secret: string }, void>({
      query: () => ({ url: "/admin/account/2fa/setup", method: "POST" }),
    }),
    enableTwoFactor: build.mutation<{ recoveryCodes: string[] }, { code: string }>({
      query: (body) => ({ url: "/admin/account/2fa/enable", method: "POST", body }),
      invalidatesTags: ["Session"],
    }),
    disableTwoFactor: build.mutation<void, { password: string; code: string }>({
      query: (body) => ({ url: "/admin/account/2fa/disable", method: "POST", body }),
      invalidatesTags: ["Session"],
    }),
    regenerateRecoveryCodes: build.mutation<
      { recoveryCodes: string[] },
      { password: string }
    >({
      query: (body) => ({
        url: "/admin/account/2fa/recovery-codes",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Session"],
    }),
    getSessions: build.query<{ data: SessionInfo[] }, void>({
      query: () => "/admin/account/sessions",
      providesTags: ["Session"],
    }),
    revokeSession: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/account/sessions/${id}`, method: "DELETE" }),
      invalidatesTags: ["Session"],
    }),
    revokeOtherSessions: build.mutation<{ ok: boolean; revoked: number }, void>({
      query: () => ({ url: "/admin/account/sessions", method: "DELETE" }),
      invalidatesTags: ["Session"],
    }),
  }),
});

export const {
  useGetStatsQuery,
  useGetActivityQuery,
  useGetHeroQuery,
  useUpdateHeroMutation,
  useGetAboutQuery,
  useUpdateAboutMutation,
  useGetCredentialsQuery,
  useCreateCredentialMutation,
  useUpdateCredentialMutation,
  useDeleteCredentialMutation,
  useReorderCredentialsMutation,
  useGetSkillsQuery,
  useCreateSkillMutation,
  useUpdateSkillMutation,
  useDeleteSkillMutation,
  useReorderSkillsMutation,
  useGetExperienceQuery,
  useCreateExperienceMutation,
  useUpdateExperienceMutation,
  useDeleteExperienceMutation,
  useReorderExperienceMutation,
  useGetSecurityFocusQuery,
  useCreateSecurityFocusMutation,
  useUpdateSecurityFocusMutation,
  useDeleteSecurityFocusMutation,
  useReorderSecurityFocusMutation,
  useGetOwaspQuery,
  useCreateOwaspMutation,
  useUpdateOwaspMutation,
  useDeleteOwaspMutation,
  useReorderOwaspMutation,
  useGetSecurityStatsQuery,
  useCreateSecurityStatMutation,
  useUpdateSecurityStatMutation,
  useDeleteSecurityStatMutation,
  useReorderSecurityStatsMutation,
  useGetProjectsQuery,
  useGetProjectQuery,
  useCreateProjectMutation,
  useUpdateProjectMutation,
  useDeleteProjectMutation,
  useFeatureProjectMutation,
  useReorderProjectsMutation,
  useReorderGalleryMutation,
  useDeleteGalleryImageMutation,
  useSetProjectCoverMutation,
  useAddProjectGalleryMutation,
  useGetResumeQuery,
  useUpdateResumeMutation,
  useDeleteResumeMutation,
  useGetConversationsQuery,
  useGetUnreadConversationsQuery,
  useGetConversationQuery,
  useGetMessagesQuery,
  useLazyGetMessagesQuery,
  useSendConversationMessageMutation,
  useMarkConversationReadMutation,
  useUpdateConversationMutation,
  useDeleteConversationMutation,
  useCreateInviteMutation,
  useResendInviteMutation,
  useRevokeInviteMutation,
  useGetSettingsQuery,
  useUpdateSettingsMutation,
  useGetTwoFactorQuery,
  useSetupTwoFactorMutation,
  useEnableTwoFactorMutation,
  useDisableTwoFactorMutation,
  useRegenerateRecoveryCodesMutation,
  useGetSessionsQuery,
  useRevokeSessionMutation,
  useRevokeOtherSessionsMutation,
} = adminApi;
