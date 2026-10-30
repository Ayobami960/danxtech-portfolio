import type { Request } from "express";
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
import { deleteStoredFile, publicMediaUrl } from "../storage/index.js";
import { storageKeyFromPublicId, validateSignedUpload } from "../lib/uploads.js";
import { contentUpdated } from "./revalidate.service.js";
import type {
  CreateProjectInput,
  SignedUploadResultInput,
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
 * The signed-upload endpoint is the only supported source for a project PDF: the
 * admin uploads directly to Cloudinary first, then attaches the metadata it
 * returned. The backend never sees the file bytes.
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
  const { url, publicId } = validateSignedUpload(document);

  return {
    documentUrl: url,
    documentFileId: publicId,
    documentStorageKey: storageKeyFromPublicId(publicId),
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
  documentUrl: project.documentUrl,
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
  /** Cloudinary public_id for coverImage (null for legacy or external images). */
  coverFileId: project.coverFileId,
  document: project.documentUrl
    ? {
        url: project.documentUrl,
        publicId: project.documentFileId,
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
    /** Cloudinary public_id, used by the admin to delete the image. */
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
  const sortOrder = input.sortOrder ?? (await maxProjectSortOrder()) + 1;
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
    (existing.documentFileId !== null || existing.documentStorageKey !== null) &&
    existing.documentStorageKey !== updated.documentStorageKey;

  if (documentReplaced) {
    await deleteStoredFile({
      fileId: existing.documentFileId,
      key: existing.documentStorageKey,
      resourceType: "raw",
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

/**
 * Attach a cover image the admin already uploaded to Cloudinary. The previous
 * object is deleted only after the row is written, so a failed update never
 * leaves the project pointing at a deleted file.
 */
export const setCover = async (
  request: Request,
  id: string,
  uploaded: SignedUploadResultInput,
): Promise<ReturnType<typeof toAdminProject>> => {
  const project = await findProjectById(id);
  if (!project) throw notFound("Project not found.");

  const validated = validateSignedUpload(uploaded);
  const key = storageKeyFromPublicId(validated.publicId);

  try {
    await updateProject(id, {
      coverImage: validated.url,
      coverFileId: validated.publicId,
      coverStorageKey: key,
      coverOriginalName: null,
      coverMimeType: null,
      coverSizeBytes: null,
      coverSha256: null,
    });
  } catch (error) {
    await deleteStoredFile({ fileId: validated.publicId }).catch(() => undefined);
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
    meta: { publicId: validated.publicId },
  });
  contentUpdated("projects", [...REVALIDATE_TAGS.projects]);
  return getAdminById(id);
};

export const addGalleryImages = async (
  request: Request,
  id: string,
  uploaded: SignedUploadResultInput[],
): Promise<ReturnType<typeof toAdminProject>> => {
  const project = await findProjectById(id);
  if (!project) throw notFound("Project not found.");
  if (uploaded.length === 0) {
    throw new AppError(
      400,
      ERROR_CODES.VALIDATION_ERROR,
      "At least one image result is required.",
    );
  }

  const validated: Array<{
    url: string;
    fileId: string;
    storageKey: string;
    sortOrder: number;
    originalName: string;
    mimeType: string;
    sizeBytes: number;
  }> = [];

  try {
    const startOrder = (await maxImageSortOrder(id)) + 1;
    for (const [index, item] of uploaded.entries()) {
      const validatedItem = validateSignedUpload(item);
      validated.push({
        url: validatedItem.url,
        fileId: validatedItem.publicId,
        storageKey: storageKeyFromPublicId(validatedItem.publicId),
        sortOrder: startOrder + index,
        originalName: `gallery-${index + 1}.webp`,
        mimeType: "image/webp",
        sizeBytes: 0,
      });
    }
    await addProjectImages(id, validated);
  } catch (error) {
    // Never leave orphaned uploads behind when the rows could not be written.
    await Promise.all(
      validated.map((item) =>
        deleteStoredFile({ fileId: item.fileId }).catch(() => undefined),
      ),
    );
    throw error;
  }

  await audit(request, {
    action: "project.gallery.add",
    entity: "project",
    entityId: id,
    meta: { count: validated.length },
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

  if (!image.storageKey.startsWith("external/")) {
    await deleteStoredFile({ fileId: image.fileId, key: image.storageKey }).catch(
      (error: unknown) => {
        logger.warn(
          { err: error, key: image.storageKey },
          "Failed to delete gallery image file",
        );
      },
    );
  }

  contentUpdated("projects", [...REVALIDATE_TAGS.projects]);
  return getAdminById(projectId);
};

// Exported for seed/tests that only need the mapped shape.
export type ProjectRecord = Project;
