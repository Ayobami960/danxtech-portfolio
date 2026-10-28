import type { Router } from "express";
import {
  deleteResume,
  getResume,
  putResume,
} from "../../controllers/admin.resume.controller.js";
import { uploadResume } from "../../middleware/upload.js";

export const registerResumeRoutes = (router: Router): void => {
  router.get("/resume", getResume);
  router.put("/resume", uploadResume, putResume);
  router.delete("/resume", deleteResume);
};
