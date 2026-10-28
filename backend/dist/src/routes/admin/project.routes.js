import { createProject, deleteGalleryImage, deleteProject, featureProject, getProject, listProjects, reorderProjectGallery, reorderProjects, updateProject, uploadCover, uploadGallery, } from "../../controllers/admin.project.controller.js";
import { uploadGalleryImages, uploadSingleImage, } from "../../middleware/upload.js";
import { validate } from "../../middleware/validate.js";
import { projectImageParams, reorderSchema, uuidParams, } from "../../schemas/common.schemas.js";
import { paginationSchema } from "../../lib/pagination.js";
import { createProjectSchema, updateProjectSchema, } from "../../schemas/project.schemas.js";
export const registerProjectRoutes = (router) => {
    router.get("/projects", validate({ query: paginationSchema }), listProjects);
    router.post("/projects", validate({ body: createProjectSchema }), createProject);
    // Registered before `/:id` so "reorder" is never parsed as a project id.
    router.patch("/projects/reorder", validate({ body: reorderSchema }), reorderProjects);
    router.get("/projects/:id", validate({ params: uuidParams }), getProject);
    router.patch("/projects/:id", validate({ params: uuidParams, body: updateProjectSchema }), updateProject);
    router.delete("/projects/:id", validate({ params: uuidParams }), deleteProject);
    router.patch("/projects/:id/featured", validate({ params: uuidParams }), featureProject);
    router.post("/projects/:id/cover", validate({ params: uuidParams }), uploadSingleImage, uploadCover);
    router.post("/projects/:id/gallery", validate({ params: uuidParams }), uploadGalleryImages, uploadGallery);
    router.patch("/projects/:id/gallery/reorder", validate({ params: uuidParams, body: reorderSchema }), reorderProjectGallery);
    router.delete("/projects/:id/gallery/:imageId", validate({ params: projectImageParams }), deleteGalleryImage);
};
//# sourceMappingURL=project.routes.js.map