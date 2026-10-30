import type { Router } from "express";
import {
  deleteResume,
  getResume,
  putResume,
} from "../../controllers/admin.resume.controller.js";
import { validate } from "../../middleware/validate.js";
import { signedUploadResultSchema } from "../../schemas/project.schemas.js";

export const registerResumeRoutes = (router: Router): void => {
  router.get("/resume", getResume);
  // Resume replaces are direct-to-cloudinary signed uploads. The admin sends
  // the Cloudinary result as JSON; the backend never sees the file bytes.
  router.put(
    "/resume",
    validate({ body: signedUploadResultSchema }),
    putResume,
  );
  router.delete("/resume", deleteResume);
};
