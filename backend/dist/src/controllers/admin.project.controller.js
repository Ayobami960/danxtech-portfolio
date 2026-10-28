// admin.project.controller.ts
import { asyncHandler } from "../lib/async-handler.js";
import { paginated } from "../lib/pagination.js";
import { body as readBody, params, query } from "../lib/request.js";
import { addGalleryImages, create, feature, getAdminById, listAdmin, remove, removeGalleryImage, reorder, reorderGallery, setCover, update, } from "../services/project.service.js";
export const listProjects = asyncHandler(async (request, response) => {
    const { page, pageSize } = query(request);
    const { rows, total } = await listAdmin(page, pageSize);
    response.status(200).json(paginated(rows, total, { page, pageSize }));
});
export const getProject = asyncHandler(async (request, response) => {
    const { id } = params(request);
    response.status(200).json(await getAdminById(id));
});
export const createProject = asyncHandler(async (request, response) => {
    const input = readBody(request);
    response.status(201).json(await create(request, input));
});
export const updateProject = asyncHandler(async (request, response) => {
    const { id } = params(request);
    const input = readBody(request);
    response.status(200).json(await update(request, id, input));
});
export const deleteProject = asyncHandler(async (request, response) => {
    const { id } = params(request);
    await remove(request, id);
    response.status(204).end();
});
export const reorderProjects = asyncHandler(async (request, response) => {
    const { ids } = readBody(request);
    await reorder(request, ids);
    response.status(200).json({ ok: true });
});
export const featureProject = asyncHandler(async (request, response) => {
    const { id } = params(request);
    response.status(200).json(await feature(request, id));
});
export const uploadCover = asyncHandler(async (request, response) => {
    const { id } = params(request);
    response.status(200).json(await setCover(request, id, request.file));
});
export const uploadGallery = asyncHandler(async (request, response) => {
    const { id } = params(request);
    const files = Array.isArray(request.files)
        ? request.files
        : undefined;
    response.status(201).json(await addGalleryImages(request, id, files));
});
export const reorderProjectGallery = asyncHandler(async (request, response) => {
    const { id } = params(request);
    const { ids } = readBody(request);
    response.status(200).json(await reorderGallery(request, id, ids));
});
export const deleteGalleryImage = asyncHandler(async (request, response) => {
    const { id, imageId } = params(request);
    response.status(200).json(await removeGalleryImage(request, id, imageId));
});
//# sourceMappingURL=admin.project.controller.js.map