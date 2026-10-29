import type { Request } from "express";
import { randomUUID } from "node:crypto";
import { AppError, ERROR_CODES, conflict, notFound } from "../lib/errors.js";
import { slugify } from "../lib/slug.js";
import { logger } from "../config/logger.js";
import { env } from "../config/env.js";
import { REVALIDATE_TAGS } from "../config/constants.js";
import {
  addProjectImages,
  createProject,
  deleteProject,
  deleteProjectImage,
  featureOnlyProject,
  findProjectById,
  findProjectImage,
  findPublicProjectBySlug,
  listAllProjects,
  listPublicProjects,
  maxImageSortOrder,
  maxProjectSortOrder,
  reorderProjectImages,
  reorderProjects,
  slugExists,
  updateProject,
  type ProjectWithImages,
} from "../repositories/project.repository.js";
import { audit } from "../repositories/audit-writer.js";
import {
  deleteStoredFile,
  getStorage,
  publicMediaUrl,
} from "../storage/index.js";
import { processImage } from "./image.service.js";
import { sha256Hex } from "../lib/crypto.js";
import { contentUpdated } from "./revalidate.service.js";
import type {
  CreateProjectInput,
  UpdateProjectInput,
} from "../schemas/project.schemas.js";
import type { Project } from "../database/schema.js";

export type PublicProject = {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  accentColor: string;
  tech: string[];
  stats: string[];
  liveUrl: string | null;
  githubUrl: string | null;
  /** Optional PDF case study attached to the project. */
  documentUrl: string | null;
  documentName: string | null;
  imageParent: string | null;
  imageBox: string[];
  featured: boolean;
};

type ProjectDocumentInput = NonNullable<CreateProjectInput["document"]>;

/**
 * The document endpoint is the only supported source for a project PDF: the
 * admin uploads there first, then attaches the metadata it returned.
 */
const documentColumns = (
  document: ProjectDocumentInput,
): Pick<
  Project,
  | "documentUrl"
  | "documentFileId"
  | "documentStorageKey"
  | "documentName"
  | "documentSizeBytes"
> => {
  const endpoint = env.storage.urlEndpoint.replace(/\/+$/, "");
  if (!document.url.startsWith(`${endpoint}/`)) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      "Upload the document first: document.url must be a file from this project's image storage.",
    );
  }

  return {
    documentUrl: document.url,
    documentFileId: document.fileId,
    documentStorageKey: document.key,
    documentName: document.name,
    documentSizeBytes: document.sizeBytes,
  };
};

/** Cache-busting version for a stored image; URLs are public and cacheable. */
const versionedMediaUrl = (url: string | null, updatedAt: Date): string | null => {
  if (!url) return null;
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${updatedAt.getTime()}`;
};

export const toPublicProject = (project: ProjectWithImages): PublicProject => ({
  id: project.id,
  slug: project.slug,
  title: project.title,
  description: project.description,
  icon: project.icon,
  accentColor: project.accentColor,
  tech: project.tech,
  stats: project.stats,
  liveUrl: project.liveUrl,
  githubUrl: project.githubUrl,
  documentUrl: publicMediaUrl(project.documentStorageKey, project.documentUrl),
  documentName: project.documentName,
  imageParent: versionedMediaUrl(
    publicMediaUrl(project.coverStorageKey, project.coverImage),
    project.updatedAt,
  ),
  imageBox: project.images
    .map((image) => publicMediaUrl(image.storageKey, image.url))
    .filter((url): url is string => url !== null)
    .map((url) => versionedMediaUrl(url, project.updatedAt) ?? url),
  featured: project.featured,
});

export const toAdminProject = (project: ProjectWithImages) => ({
  id: project.id,
  slug: project.slug,
  title: project.title,
  description: project.description,
  icon: project.icon,
  accentColor: project.accentColor,
  tech: project.tech,
  stats: project.stats,
  liveUrl: project.liveUrl,
  githubUrl: project.githubUrl,
  coverImage: publicMediaUrl(project.coverStorageKey, project.coverImage),
  /** ImageKit fileId for coverImage (null for legacy or external images). */
  coverFileId: project.coverFileId,
  document: project.documentStorageKey
    ? {
        url: publicMediaUrl(project.documentStorageKey, project.documentUrl),
        fileId: project.documentFileId,
        key: project.documentStorageKey,
        name: project.documentName ?? "document.pdf",
        sizeBytes: project.documentSizeBytes ?? 0,
      }
    : null,
  featured: project.featured,
  published: project.published,
  sortOrder: project.sortOrder,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
  gallery: project.images.map((image) => ({
    id: image.id,
    url: publicMediaUrl(image.storageKey, image.url),
    /** ImageKit fileId, used by the admin to delete the image. */
    fileId: image.fileId,
    sortOrder: image.sortOrder,
  })),
});

export const listPublic = async (tech?: string): Promise<PublicProject[]> => {
  const rows = await listPublicProjects(tech);
  return rows.map(toPublicProject);
};

export const getPublicBySlug = async (
  slug: string,
): Promise<PublicProject> => {
  const project = await findPublicProjectBySlug(slug);
  if (!project) throw notFound("Project not found.");
  return toPublicProject(project);
};

export const listAdmin = async (page: number, pageSize: number) => {
  const { rows, total } = await listAllProjects(page, pageSize);
  return { rows: rows.map(toAdminProject), total };
};

export const getAdminById = async (id: string) => {
  const project = await findProjectById(id);
  if (!project) throw notFound("Project not found.");
  return toAdminProject(project);
};

const uniqueSlug = async (title: string): Promise<string> => {
  const base = slugify(title).slice(0, 110);
  let candidate = base;
  let suffix = 2;
  while (await slugExists(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
};

export const create = async (
  request: Request,
  input: CreateProjectInput,
): Promise<ReturnType<typeof toAdminProject>> => {
  const sortOrder =
    input.sortOrder ?? (await maxProjectSortOrder()) + 1;
  const project = await createProject({
    slug: await uniqueSlug(input.title),
    title: input.title,
    description: input.description,
    icon: input.icon,
    accentColor: input.accentColor,
    tech: input.tech,
    stats: input.stats,
    liveUrl: input.liveUrl ?? null,
    githubUrl: input.githubUrl ?? null,
    published: input.published,
    sortOrder,
    ...(input.document ? documentColumns(input.document) : {}),
  });

  await audit(request, {
    action: "project.create",
    entity: "project",
    entityId: project.id,
  });
  contentUpdated("projects", [...REVALIDATE_TAGS.projects]);
  return getAdminById(project.id);
};

export const update = async (
  request: Request,
  id: string,
  input: UpdateProjectInput,
): Promise<ReturnType<typeof toAdminProject>> => {
  const existing = await findProjectById(id);
  if (!existing) throw notFound("Project not found.");

  if (input.slug && input.slug !== existing.slug) {
    if (await slugExists(input.slug)) {
      throw conflict("That slug is already in use.");
    }
  }

  const { document, ...patch } = input;
  const documentPatch =
    document === undefined
      ? {}
      : document === null
        ? {
            documentUrl: null,
            documentFileId: null,
            documentStorageKey: null,
            documentName: null,
            documentSizeBytes: null,
          }
        : documentColumns(document);

  const updated = await updateProject(id, {
    ...patch,
    ...(patch.liveUrl === undefined ? {} : { liveUrl: patch.liveUrl }),
    ...(patch.githubUrl === undefined ? {} : { githubUrl: patch.githubUrl }),
    ...documentPatch,
  });
  if (!updated) throw notFound("Project not found.");

  // Replacing or clearing the PDF removes the previous object; a failure here
  // only orphans a file, which is preferable to failing a committed update.
  const documentReplaced =
    document !== undefined &&
    (existing.documentStorageKey !== null ||
      existing.documentFileId !== null) &&
    existing.documentStorageKey !== updated.documentStorageKey;

  if (documentReplaced) {
    await deleteStoredFile({
      fileId: existing.documentFileId,
      key: existing.documentStorageKey,
    }).catch((error: unknown) => {
      logger.warn(
        { err: error, key: existing.documentStorageKey },
        "Failed to delete the replaced project document",
      );
    });
  }

  await audit(request, {
    action: "project.update",
    entity: "project",
    entityId: id,
    meta: { fields: Object.keys(input) },
  });
  contentUpdated("projects", [...REVALIDATE_TAGS.projects]);
  return getAdminById(id);
};

export const remove = async (request: Request, id: string): Promise<void> => {
  const project = await findProjectById(id);
  if (!project) throw notFound("Project not found.");

  await deleteProject(id);
  await audit(request, {
    action: "project.delete",
    entity: "project",
    entityId: id,
  });

  const files = [
    { fileId: project.coverFileId, key: project.coverStorageKey },
    { fileId: project.documentFileId, key: project.documentStorageKey },
    ...project.images.map((image) => ({
      fileId: image.fileId,
      key: image.storageKey,
    })),
  ].filter((file) => file.fileId !== null || Boolean(file.key));

  // The database is the source of truth; an orphaned file is preferable to a
  // failed delete that leaves the project visible.
  for (const file of files) {
    // Seed images live in the Client's public directory, not our storage.
    if (file.key?.startsWith("external/")) continue;
    try {
      await deleteStoredFile(file);
    } catch (error) {
      logger.warn({ err: error, ...file }, "Failed to delete project file");
    }
  }

  contentUpdated("projects", [...REVALIDATE_TAGS.projects]);
};

export const feature = async (
  request: Request,
  id: string,
): Promise<ReturnType<typeof toAdminProject>> => {
  const project = await findProjectById(id);
  if (!project) throw notFound("Project not found.");

  await featureOnlyProject(id);
  await audit(request, {
    action: "project.feature",
    entity: "project",
    entityId: id,
  });
  contentUpdated("projects", [...REVALIDATE_TAGS.projects]);
  return getAdminById(id);
};

export const reorder = async (
  request: Request,
  ids: string[],
): Promise<void> => {
  await reorderProjects(ids);
  await audit(request, {
    action: "project.reorder",
    entity: "project",
    meta: { ids },
  });
  contentUpdated("projects", [...REVALIDATE_TAGS.projects]);
};

export const setCover = async (
  request: Request,
  id: string,
  file: Express.Multer.File | undefined,
): Promise<ReturnType<typeof toAdminProject>> => {
  const project = await findProjectById(id);
  if (!project) throw notFound("Project not found.");
  if (!file) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      "An image file is required in the `file` field.",
    );
  }

  const storage = getStorage();
  const processed = await processImage(file.buffer, file.originalname);
  const key = `projects/${id}/${randomUUID()}.webp`;
  const stored = await storage.put(key, processed.buffer, processed.contentType);

  try {
    await updateProject(id, {
      coverImage: stored.url,
      coverFileId: stored.fileId,
      coverStorageKey: stored.key,
      coverOriginalName: file.originalname.slice(0, 255) || null,
      coverMimeType: processed.contentType,
      coverSizeBytes: processed.buffer.length,
      coverSha256: sha256Hex(processed.buffer),
    });
  } catch (error) {
    // Never leave an orphaned upload behind when the row could not be written.
    await deleteStoredFile(stored).catch(() => undefined);
    throw error;
  }

  if (project.coverStorageKey !== null || project.coverFileId !== null) {
    await deleteStoredFile({
      fileId: project.coverFileId,
      key: project.coverStorageKey,
    }).catch((error: unknown) => {
      logger.warn(
        { err: error, key: project.coverStorageKey },
        "Failed to delete the replaced cover image",
      );
    });
  }

  await audit(request, {
    action: "project.cover.update",
    entity: "project",
    entityId: id,
    meta: {
      sizeBytes: processed.buffer.length,
      mimeType: processed.contentType,
    },
  });
  contentUpdated("projects", [...REVALIDATE_TAGS.projects]);
  return getAdminById(id);
};

export const addGalleryImages = async (
  request: Request,
  id: string,
  files: Express.Multer.File[] | undefined,
): Promise<ReturnType<typeof toAdminProject>> => {
  const project = await findProjectById(id);
  if (!project) throw notFound("Project not found.");
  if (!files || files.length === 0) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      "At least one image is required in the `files` field.",
    );
  }

  const processed = await Promise.all(
    files.map(async (file) => ({
      file,
      image: await processImage(file.buffer, file.originalname),
    })),
  );

  const storage = getStorage();
  const uploaded: Array<{
    url: string;
    fileId: string | null;
    storageKey: string;
    sortOrder: number;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
  }> = [];

  try {
    const startOrder = (await maxImageSortOrder(id)) + 1;
    for (const [index, item] of processed.entries()) {
      const key = `projects/${id}/${randomUUID()}.webp`;
      const stored = await storage.put(
        key,
        item.image.buffer,
        item.image.contentType,
      );
      uploaded.push({
        url: stored.url,
        fileId: stored.fileId,
        storageKey: stored.key,
        sortOrder: startOrder + index,
        originalName: item.file.originalname.slice(0, 255) || `image-${index + 1}.webp`,
        mimeType: item.image.contentType,
        sizeBytes: item.image.buffer.length,
        sha256: sha256Hex(item.image.buffer),
      });
    }
    await addProjectImages(id, uploaded);
  } catch (error) {
    // Never leave orphaned uploads behind when the rows could not be written.
    await Promise.all(
      uploaded.map((item) =>
        deleteStoredFile(item).catch(() => undefined),
      ),
    );
    throw error;
  }

  await audit(request, {
    action: "project.gallery.add",
    entity: "project",
    entityId: id,
    meta: { count: uploaded.length },
  });
  contentUpdated("projects", [...REVALIDATE_TAGS.projects]);
  return getAdminById(id);
};

export const reorderGallery = async (
  request: Request,
  id: string,
  ids: string[],
): Promise<ReturnType<typeof toAdminProject>> => {
  const project = await findProjectById(id);
  if (!project) throw notFound("Project not found.");

  await reorderProjectImages(id, ids);
  await audit(request, {
    action: "project.gallery.reorder",
    entity: "project",
    entityId: id,
    meta: { ids },
  });
  contentUpdated("projects", [...REVALIDATE_TAGS.projects]);
  return getAdminById(id);
};

export const removeGalleryImage = async (
  request: Request,
  projectId: string,
  imageId: string,
): Promise<ReturnType<typeof toAdminProject>> => {
  const image = await findProjectImage(imageId);
  if (!image || image.projectId !== projectId) {
    throw notFound("Image not found.");
  }

  await deleteProjectImage(imageId);
  await audit(request, {
    action: "project.gallery.delete",
    entity: "project",
    entityId: projectId,
    meta: { imageId },
  });

  try {
    if (!image.storageKey.startsWith("external/")) {
      await deleteStoredFile({ fileId: image.fileId, key: image.storageKey });
    }
  } catch (error) {
    logger.warn(
      { err: error, key: image.storageKey },
      "Failed to delete gallery image file",
    );
  }

  contentUpdated("projects", [...REVALIDATE_TAGS.projects]);
  return getAdminById(projectId);
};

// Exported for seed/tests that only need the mapped shape.
export type ProjectRecord = Project;
