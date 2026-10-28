import { count, eq, max } from "drizzle-orm";
import { db } from "../db/client.js";
import { projects } from "../database/schema.js";
import {
  countAllMessages,
  countUnreadMessages,
} from "../repositories/contact.repository.js";
import {
  countOpenConversations,
  countConversations,
  countUnreadConversations,
} from "../repositories/conversation.repository.js";
import { getResume } from "../repositories/resume.repository.js";
import { getHero } from "../repositories/hero.repository.js";
import { getAbout } from "../repositories/site.repository.js";
import { getStorage } from "../storage/index.js";

export const dashboardStats = async () => {
  const [
    unreadMessages,
    messages,
    projectCounts,
    resume,
    hero,
    about,
    unreadChats,
    openChats,
    conversations,
    lastContent,
  ] = await Promise.all([
    countUnreadMessages(),
    countAllMessages(),
    db
      .select({ published: projects.published, value: count() })
      .from(projects)
      .groupBy(projects.published),
    getResume(),
    getHero(),
    getAbout(),
    countUnreadConversations(),
    countOpenConversations(),
    countConversations(),
    db.select({ value: max(projects.updatedAt) }).from(projects),
  ]);

  const published = projectCounts.find((row) => row.published)?.["value"] ?? 0;
  const drafts = projectCounts.find((row) => !row.published)?.["value"] ?? 0;

  const candidates = [
    lastContent[0]?.value ?? null,
    resume?.updatedAt ?? null,
    about?.updatedAt ?? null,
  ].filter((value): value is Date => value instanceof Date);

  const lastContentUpdate =
    candidates.length > 0
      ? new Date(Math.max(...candidates.map((value) => value.getTime())))
      : null;

  const heroUpdatedAt = hero?.updatedAt ?? null;
  const lastUpdate =
    lastContentUpdate && heroUpdatedAt
      ? new Date(Math.max(lastContentUpdate.getTime(), heroUpdatedAt.getTime()))
      : (lastContentUpdate ?? heroUpdatedAt);

  return {
    messages: { unread: unreadMessages, total: messages },
    conversations: {
      unread: unreadChats,
      open: openChats,
      total: conversations,
    },
    projects: {
      published,
      draft: drafts,
      total: published + drafts,
    },
    resume: {
      available: resume !== null,
      downloadCount: resume?.downloadCount ?? 0,
      updatedAt: resume?.updatedAt ?? null,
    },
    hero: {
      updatedAt: heroUpdatedAt,
    },
    lastContentUpdate: lastUpdate,
    storageDriver: getStorage().name,
  };
};

// Kept for the health endpoint's cheap published-project probe.
export const countPublishedProjects = async (): Promise<number> => {
  const rows = await db
    .select({ value: count() })
    .from(projects)
    .where(eq(projects.published, true));
  return rows[0]?.value ?? 0;
};
