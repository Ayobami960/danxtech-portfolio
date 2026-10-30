// admin.project.controller.ts
import { asyncHandler } from "../lib/async-handler.js";
import { paginated, type Pagination } from "../lib/pagination.js";
import { body as readBody, params, query } from "../lib/request.js";
import type {
  CreateProjectInput,
  SignedUploadResultInput,
  UpdateProjectInput,
} from "../schemas/project.schemas.js";
import {
  addGalleryImages,
  create,
  feature,
  getAdminById,
  listAdmin,
  remove,
  removeGalleryImage,
  reorder,
  reorderGallery,
  setCover,
  update,
} from "../services/project.service.js";

export const listProjects = asyncHandler(async (request, response) => {
  const { page, pageSize } = query<Pagination>(request);
  const { rows, total } = await listAdmin(page, pageSize);
  response.status(200).json(paginated(rows, total, { page, pageSize }));
});

export const getProject = asyncHandler(async (request, response) => {
  const { id } = params<{ id: string }>(request);
  response.status(200).json(await getAdminById(id));
});

export const createProject = asyncHandler(async (request, response) => {
  const input = readBody<CreateProjectInput>(request);
  response.status(201).json(await create(request, input));
});

export const updateProject = asyncHandler(async (request, response) => {
  const { id } = params<{ id: string }>(request);
  const input = readBody<UpdateProjectInput>(request);
  response.status(200).json(await update(request, id, input));
});

export const deleteProject = asyncHandler(async (request, response) => {
  const { id } = params<{ id: string }>(request);
  await remove(request, id);
  response.status(204).end();
});

export const reorderProjects = asyncHandler(async (request, response) => {
  const { ids } = readBody<{ ids: string[] }>(request);
  await reorder(request, ids);
  response.status(200).json({ ok: true });
});

export const featureProject = asyncHandler(async (request, response) => {
  const { id } = params<{ id: string }>(request);
  response.status(200).json(await feature(request, id));
});

/** JSON only: the browser already uploaded the cover to Cloudinary. */
export const uploadCover = asyncHandler(async (request, response) => {
  const { id } = params<{ id: string }>(request);
  const uploaded = readBody<SignedUploadResultInput>(request);
  response.status(200).json(await setCover(request, id, uploaded));
});

/** JSON only: the browser already uploaded the gallery images to Cloudinary. */
export const uploadGallery = asyncHandler(async (request, response) => {
  const { id } = params<{ id: string }>(request);
  const { results } = readBody<{ results: SignedUploadResultInput[] }>(request);
  response.status(201).json(await addGalleryImages(request, id, results));
});

export const reorderProjectGallery = asyncHandler(async (request, response) => {
  const { id } = params<{ id: string }>(request);
  const { ids } = readBody<{ ids: string[] }>(request);
  response.status(200).json(await reorderGallery(request, id, ids));
});

export const deleteGalleryImage = asyncHandler(async (request, response) => {
  const { id, imageId } = params<{ id: string; imageId: string }>(request);
  response.status(200).json(await removeGalleryImage(request, id, imageId));
});
