import { Router } from "express";
import {
  changePassword,
  getCsrf,
  login,
  logout,
  me,
  refresh,
  verifyTwoFactor,
} from "../controllers/auth.controller.js";
import { requireAuth } from "../middleware/auth.js";
import { requireCsrf } from "../middleware/csrf.js";
import {
  authLimiter,
  loginEmailLimiter,
  loginIpLimiter,
} from "../middleware/rate-limit.js";
import { validate } from "../middleware/validate.js";
import {
  changePasswordSchema,
  loginSchema,
  twoFactorVerifySchema,
} from "../schemas/auth.schemas.js";

export const authRouter = Router();

authRouter.get("/csrf", authLimiter(), getCsrf);

// Login is the one state-changing auth route exempt from CSRF: the browser has
// no token before it authenticates.
authRouter.post(
  "/login",
  loginIpLimiter(),
  loginEmailLimiter(),
  validate({ body: loginSchema }),
  login,
);

authRouter.post(
  "/2fa/verify",
  authLimiter(),
  requireCsrf,
  validate({ body: twoFactorVerifySchema }),
  verifyTwoFactor,
);

authRouter.post("/refresh", authLimiter(), requireCsrf, refresh);
authRouter.post("/logout", authLimiter(), requireCsrf, logout);

authRouter.get("/me", requireAuth, me);
authRouter.patch(
  "/password",
  authLimiter(),
  requireAuth,
  requireCsrf,
  validate({ body: changePasswordSchema }),
  changePassword,
);
