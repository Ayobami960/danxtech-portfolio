import { Router } from "express";
import { adminRouter } from "./admin/index.js";
import { authRouter } from "./auth.routes.js";
import { publicRouter } from "./public.routes.js";
export const apiRouter = Router();
apiRouter.use(publicRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/admin", adminRouter);
//# sourceMappingURL=index.js.map