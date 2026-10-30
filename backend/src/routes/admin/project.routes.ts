import type { Router } from "express";
import {
  createProject,
  deleteGalleryImage,
  deleteProject,
  featureProject,
  getProject,
  listProjects,
  reorderProjectGallery,
  reorderProjects,
  updateProject,
  uploadCover,
  uploadGallery,
} from "../../controllers/admin.project.controller.js";
import { validate } from "../../middleware/validate.js";
import {
  projectImageParams,
  reorderSchema,
  uuidParams,
} from "../../schemas/common.schemas.js";
import { paginationSchema } from "../../lib/pagination.js";
import {
  createProjectSchema,
  signedUploadListSchema,
  signedUploadResultSchema,
  updateProjectSchema,
} from "../../schemas/project.schemas.js";

export const registerProjectRoutes = (router: Router): void => {
  router.get("/projects", validate({ query: paginationSchema }), listProjects);
  router.post(
    "/projects",
    validate({ body: createProjectSchema }),
    createProject,
  );

  // Registered before `/:id` so "reorder" is never parsed as a project id.
  router.patch(
    "/projects/reorder",
    validate({ body: reorderSchema }),
    reorderProjects,
  );

  router.get("/projects/:id", validate({ params: uuidParams }), getProject);
  router.patch(
    "/projects/:id",
    validate({ params: uuidParams, body: updateProjectSchema }),
    updateProject,
  );
  router.delete(
    "/projects/:id",
    validate({ params: uuidParams }),
    deleteProject,
  );

  router.patch(
    "/projects/:id/featured",
    validate({ params: uuidParams }),
    featureProject,
  );

  // Cover and gallery are direct-to-cloudinary signed uploads. The admin
  // sends the Cloudinary result as JSON; the backend never sees the file bytes.
  router.post(
    "/projects/:id/cover",
    validate({ params: uuidParams, body: signedUploadResultSchema }),
    uploadCover,
  );
  router.post(
    "/projects/:id/gallery",
    validate({ params: uuidParams, body: signedUploadListSchema }),
    uploadGallery,
  );
  router.patch(
    "/projects/:id/gallery/reorder",
    validate({ params: uuidParams, body: reorderSchema }),
    reorderProjectGallery,
  );
  router.delete(
    "/projects/:id/gallery/:imageId",
    validate({ params: projectImageParams }),
    deleteGalleryImage,
  );
};
