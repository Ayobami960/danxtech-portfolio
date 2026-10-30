import { Router } from "express";
import { adminRouter } from "./admin/index.js";
import { authRouter } from "./auth.routes.js";
import { publicRouter } from "./public.routes.js";
import { uploadsRouter } from "./uploads.routes.js";
import { adminIpAllowlist } from "../middleware/admin-ip.js";

export const apiRouter = Router();

apiRouter.use(publicRouter);
apiRouter.use("/auth", authRouter);
// Signing and deleting media are admin operations, so they sit behind the same
// IP allowlist as /admin (the router itself enforces auth and CSRF).
apiRouter.use("/uploads", adminIpAllowlist, uploadsRouter);
apiRouter.use("/admin", adminRouter);
