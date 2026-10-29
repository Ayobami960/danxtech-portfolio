import { Router } from "express";
import { adminIpAllowlist } from "../../middleware/admin-ip.js";
import { requireAuth } from "../../middleware/auth.js";
import { requireCsrfForMutations } from "../../middleware/csrf.js";
import { registerAccountRoutes } from "./account.routes.js";
import { registerDashboardRoutes } from "./dashboard.routes.js";
import { registerDocumentRoutes } from "./document.routes.js";
import { registerHeroRoutes } from "./hero.routes.js";
import { registerMessageRoutes } from "./message.routes.js";
import { registerProjectRoutes } from "./project.routes.js";
import { registerResumeRoutes } from "./resume.routes.js";
import {
  registerExperienceRoutes,
  registerSecurityRoutes,
  registerSkillRoutes,
} from "./content.routes.js";
import { registerSiteRoutes } from "./site.routes.js";
import { registerConversationRoutes } from "./conversation.routes.js";

/**
 * Single admin router. Auth, the optional IP allowlist and CSRF are mounted
 * here, before any route, so every path under /api/admin is private by default
 * and a newly added route cannot accidentally become public.
 *
 * All admin routes are registered directly on this router (no nested routers),
 * which lets the authorization-sweep test enumerate every registered route.
 */
export const adminRouter = Router();

adminRouter.use(adminIpAllowlist);
adminRouter.use(requireAuth);
adminRouter.use(requireCsrfForMutations);

registerDashboardRoutes(adminRouter);
registerHeroRoutes(adminRouter);
registerProjectRoutes(adminRouter);
registerMessageRoutes(adminRouter);
registerResumeRoutes(adminRouter);
registerSkillRoutes(adminRouter);
registerExperienceRoutes(adminRouter);
registerSecurityRoutes(adminRouter);
registerSiteRoutes(adminRouter);
registerAccountRoutes(adminRouter);
registerConversationRoutes(adminRouter);
registerDocumentRoutes(adminRouter);
