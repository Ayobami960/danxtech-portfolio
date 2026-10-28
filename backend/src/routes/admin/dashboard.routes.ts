import type { Router } from "express";
import {
  activityQuerySchema,
  getActivity,
  getStats,
} from "../../controllers/admin.dashboard.controller.js";
import { validate } from "../../middleware/validate.js";

export const registerDashboardRoutes = (router: Router): void => {
  router.get("/stats", getStats);
  router.get("/activity", validate({ query: activityQuerySchema }), getActivity);
};
