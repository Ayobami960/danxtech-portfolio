import { and, asc, count, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "../db/client.js";
import {
  projectImages,
  projects,
  type NewProject,
  type Project,
} from "../database/schema.js";

export type ProjectWithImages = Project & {
  images: Array<{
    id: string;
    projectId: string;
    url: string;
    fileId: string | null;
    storageKey: string;
    originalName: string | null;
    mimeType: string | null;
    sizeBytes: number | null;
    sha256: string | null;
    sortOrder: number;
    createdAt: Date;
  }>;
};

const imageOrder = [asc(projectImages.sortOrder), asc(projectImages.createdAt)];

export const listPublicProjects = async (
  tech?: string,
): Promise<ProjectWithImages[]> => {
  const conditions = [eq(projects.published, true)];
  if (tech) {
    conditions.push(
      sql`lower(${tech}) = any(array(select lower(skill) from unnest(${projects.tech}) as skill))`,
    );
  }

  return db.query.projects.findMany({
    where: and(...conditions),
    orderBy: [
      desc(projects.featured),
      asc(projects.sortOrder),
      asc(projects.createdAt),
    ],
    with: { images: { orderBy: imageOrder } },
  });
};

export const findPublicProjectBySlug = async (
  slug: string,
): Promise<ProjectWithImages | null> => {
  const project = await db.query.projects.findFirst({
    where: and(eq(projects.slug, slug), eq(projects.published, true)),
    with: { images: { orderBy: imageOrder } },
  });
  return project ?? null;
};

export const listAllProjects = async (
  page: number,
  pageSize: number,
): Promise<{ rows: ProjectWithImages[]; total: number }> => {
  const [rows, totals] = await Promise.all([
    db.query.projects.findMany({
      orderBy: [asc(projects.sortOrder), asc(projects.createdAt)],
      limit: pageSize,
      offset: (page - 1) * pageSize,
      with: { images: { orderBy: imageOrder } },
    }),
    db.select({ value: count() }).from(projects),
  ]);
  return { rows, total: totals[0]?.value ?? 0 };
};

export const findProjectById = async (
  id: string,
): Promise<ProjectWithImages | null> => {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, id),
    with: { images: { orderBy: imageOrder } },
  });
  return project ?? null;
};

export const findProjectBySlug = async (
  slug: string,
): Promise<Project | null> => {
  const rows = await db
    .select()
    .from(projects)
    .where(eq(projects.slug, slug))
    .limit(1);
  return rows[0] ?? null;
};

export const slugExists = async (slug: string): Promise<boolean> => {
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.slug, slug))
    .limit(1);
  return rows.length > 0;
};

export const createProject = async (
  input: Omit<NewProject, "id">,
): Promise<Project> => {
  const rows = await db.insert(projects).values(input).returning();
  const created = rows[0];
  if (!created) throw new Error("Failed to create the project.");
  return created;
};

export type ProjectUpdate = {
  [K in keyof Omit<NewProject, "id" | "createdAt">]?:
    | Omit<NewProject, "id" | "createdAt">[K]
    | undefined;
};

export const updateProject = async (
  id: string,
  input: ProjectUpdate,
): Promise<Project | null> => {
  const rows = await db
    .update(projects)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();
  return rows[0] ?? null;
};

export const deleteProject = async (id: string): Promise<void> => {
  await db.delete(projects).where(eq(projects.id, id));
};

/** A project currently pointing at this document, if any. */
export const findProjectByDocumentFileId = async (
  fileId: string,
): Promise<{ id: string; slug: string } | null> => {
  const rows = await db
    .select({ id: projects.id, slug: projects.slug })
    .from(projects)
    .where(eq(projects.documentFileId, fileId))
    .limit(1);
  return rows[0] ?? null;
};

export const maxProjectSortOrder = async (): Promise<number> => {
  const rows = await db
    .select({ value: sql<number | null>`max(${projects.sortOrder})` })
    .from(projects);
  return rows[0]?.value ?? -1;
};

export const featureOnlyProject = async (id: string): Promise<void> => {
  await db.transaction(async (tx) => {
    await tx
      .update(projects)
      .set({ featured: false, updatedAt: new Date() })
      .where(eq(projects.featured, true));
    await tx
      .update(projects)
      .set({ featured: true, updatedAt: new Date() })
      .where(eq(projects.id, id));
  });
};

export const reorderProjects = async (ids: string[]): Promise<void> => {
  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx
        .update(projects)
        .set({ sortOrder: index, updatedAt: new Date() })
        .where(eq(projects.id, id));
    }
  });
};

export const maxImageSortOrder = async (
  projectId: string,
): Promise<number> => {
  const rows = await db
    .select({ value: sql<number | null>`max(${projectImages.sortOrder})` })
    .from(projectImages)
    .where(eq(projectImages.projectId, projectId));
  return rows[0]?.value ?? -1;
};

export const addProjectImages = async (
  projectId: string,
  images: Array<{
    url: string;
    fileId?: string | null;
    storageKey: string;
    sortOrder: number;
    originalName?: string;
    mimeType?: string;
    sizeBytes?: number;
    sha256?: string;
  }>,
): Promise<void> => {
  if (images.length === 0) return;
  await db.insert(projectImages).values(
    images.map((image) => ({
      ...image,
      projectId,
      fileId: image.fileId ?? null,
      originalName: image.originalName ?? null,
      mimeType: image.mimeType ?? null,
      sizeBytes: image.sizeBytes ?? null,
      sha256: image.sha256 ?? null,
    })),
  );
};

export const findProjectImage = async (
  imageId: string,
): Promise<{
  id: string;
  projectId: string;
  storageKey: string;
  fileId: string | null;
} | null> => {
  const rows = await db
    .select({
      id: projectImages.id,
      projectId: projectImages.projectId,
      storageKey: projectImages.storageKey,
      fileId: projectImages.fileId,
    })
    .from(projectImages)
    .where(eq(projectImages.id, imageId))
    .limit(1);
  return rows[0] ?? null;
};

export const deleteProjectImage = async (imageId: string): Promise<void> => {
  await db.delete(projectImages).where(eq(projectImages.id, imageId));
};

export type StoredPublicIdRow = {
  id: string;
  /** Cloudinary public_id; null on rows that predate the Cloudinary flow. */
  publicId: string | null;
};

/**
 * Cloudinary public_ids the API is expected to serve. Used by the startup
 * integrity check so it never duplicates SQL that already lives here. Legacy
 * rows keep their ImageKit-era key in a different column and have no public_id,
 * so they are not checked against Cloudinary.
 */
export const listStoredCoverKeys = async (): Promise<StoredPublicIdRow[]> => {
  const rows = await db
    .select({ id: projects.id, publicId: projects.coverFileId })
    .from(projects)
    .where(isNotNull(projects.coverFileId));
  return rows.map((row) => ({ id: row.id, publicId: row.publicId }));
};

export const listStoredGalleryKeys = async (): Promise<StoredPublicIdRow[]> => {
  const rows = await db
    .select({ id: projectImages.id, publicId: projectImages.fileId })
    .from(projectImages);
  return rows.map((row) => ({ id: row.id, publicId: row.publicId }));
};

export const reorderProjectImages = async (
  projectId: string,
  ids: string[],
): Promise<void> => {
  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx
        .update(projectImages)
        .set({ sortOrder: index })
        .where(
          and(
            eq(projectImages.id, id),
            eq(projectImages.projectId, projectId),
          ),
        );
    }
  });
};
