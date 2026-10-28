import type { Request } from "express";
import { randomUUID } from "node:crypto";
import { AppError, ERROR_CODES, conflict, notFound } from "../lib/errors.js";
import { slugify } from "../lib/slug.js";
import { logger } from "../config/logger.js";
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
import { getStorage, publicMediaUrl } from "../storage/index.js";
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
  imageParent: string | null;
  imageBox: string[];
  featured: boolean;
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
  featured: project.featured,
  published: project.published,
  sortOrder: project.sortOrder,
  createdAt: project.createdAt,
  updatedAt: project.updatedAt,
  gallery: project.images.map((image) => ({
    id: image.id,
    url: publicMediaUrl(image.storageKey, image.url),
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

  const updated = await updateProject(id, {
    ...input,
    ...(input.liveUrl === undefined ? {} : { liveUrl: input.liveUrl }),
    ...(input.githubUrl === undefined ? {} : { githubUrl: input.githubUrl }),
  });
  if (!updated) throw notFound("Project not found.");

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

  const storage = getStorage();
  const keys = [
    project.coverStorageKey,
    ...project.images.map((image) => image.storageKey),
  ].filter((key): key is string => Boolean(key));

  // The database is the source of truth; an orphaned file is preferable to a
  // failed delete that leaves the project visible.
  for (const key of keys) {
    // Seed images live in the Client's public directory, not our storage.
    if (key.startsWith("external/")) continue;
    try {
      await storage.delete(key);
    } catch (error) {
      logger.warn({ err: error, key }, "Failed to delete project file");
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

  const processed = await processImage(file.buffer, file.originalname);
  const key = `projects/${id}/${randomUUID()}.webp`;
  const storage = getStorage();
  await storage.put(key, processed.buffer, processed.contentType);
  const url = storage.publicUrl(key);

  try {
    await updateProject(id, {
      coverImage: url,
      coverStorageKey: key,
      coverOriginalName: file.originalname.slice(0, 255) || null,
      coverMimeType: processed.contentType,
      coverSizeBytes: processed.buffer.length,
      coverSha256: sha256Hex(processed.buffer),
    });
  } catch (error) {
    await storage.delete(key).catch(() => undefined);
    throw error;
  }

  if (project.coverStorageKey && project.coverStorageKey !== key) {
    await storage.delete(project.coverStorageKey).catch((error: unknown) => {
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
      await storage.put(key, item.image.buffer, item.image.contentType);
      uploaded.push({
        url: storage.publicUrl(key),
        storageKey: key,
        sortOrder: startOrder + index,
        originalName: item.file.originalname.slice(0, 255) || `image-${index + 1}.webp`,
        mimeType: item.image.contentType,
        sizeBytes: item.image.buffer.length,
        sha256: sha256Hex(item.image.buffer),
      });
    }
    await addProjectImages(id, uploaded);
  } catch (error) {
    await Promise.all(
      uploaded.map((item) =>
        storage.delete(item.storageKey).catch(() => undefined),
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
      await getStorage().delete(image.storageKey);
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
