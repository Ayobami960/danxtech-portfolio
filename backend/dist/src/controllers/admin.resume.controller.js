// admin.resume.controller.ts
import { asyncHandler } from "../lib/async-handler.js";
import { readAdminMetadata, removeResume, uploadResume } from "../services/resume.service.js";
export const getResume = asyncHandler(async (_request, response) => {
    const metadata = await readAdminMetadata();
    response.status(200).json(metadata === null ? { available: false } : { available: true, ...metadata });
});
export const putResume = asyncHandler(async (request, response) => {
    response.status(200).json(await uploadResume(request, request.file));
});
export const deleteResume = asyncHandler(async (request, response) => {
    await removeResume(request);
    response.status(204).end();
});
//# sourceMappingURL=admin.resume.controller.js.map