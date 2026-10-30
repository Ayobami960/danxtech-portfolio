import { Router } from "express";
import {
  downloadResume,
  health,
  hero,
  projectBySlug,
  projects,
  resumeMetadata,
  submitContact,
} from "../controllers/public.controller.js";
import {
  getAbout,
  getCredentials,
  getSettings,
  getSite,
} from "../controllers/site.controller.js";
import {
  chatJoin,
  chatLogout,
  chatMessages,
  chatSeen,
  chatSendMessage,
  chatUploadImageUnavailable,
  chatVerifyConfirm,
  chatVerifyRequest,
} from "../controllers/chat.public.controller.js";
import {
  chatJoinLimiter,
  chatLimiter,
  chatVerifyConfirmLimiter,
  chatVerifyEmailLimiter,
  chatVerifyIpLimiter,
} from "../middleware/rate-limit.js";
import {
  getExperience,
  getSecurity,
  getSkills,
} from "../controllers/content.controller.js";
import { contactLimiter } from "../middleware/rate-limit.js";
import { validate } from "../middleware/validate.js";
import { contactSubmissionSchema } from "../schemas/contact.schemas.js";
import {
  chatMessagesQuerySchema,
  chatSeenSchema,
  chatSendSchema,
  chatVerificationConfirmSchema,
  chatVerificationRequestSchema,
} from "../schemas/chat.schemas.js";
import {
  projectListQuerySchema,
  projectSlugParamsSchema,
  resumeDownloadQuerySchema,
} from "../schemas/public.schemas.js";

export const publicRouter = Router();

publicRouter.get("/health", health);

publicRouter.get("/hero", hero);
publicRouter.get(
  "/projects",
  validate({ query: projectListQuerySchema }),
  projects,
);
publicRouter.get(
  "/projects/:slug",
  validate({ params: projectSlugParamsSchema }),
  projectBySlug,
);

publicRouter.post(
  "/contact",
  contactLimiter(),
  validate({ body: contactSubmissionSchema }),
  submitContact,
);

publicRouter.get("/resume", resumeMetadata);
publicRouter.get(
  "/resume/download",
  validate({ query: resumeDownloadQuerySchema }),
  downloadResume,
);

publicRouter.get("/skills", getSkills);
publicRouter.get("/experience", getExperience);
publicRouter.get("/security", getSecurity);

publicRouter.get("/about", getAbout);
publicRouter.get("/credentials", getCredentials);
publicRouter.get("/settings", getSettings);
publicRouter.get("/site", getSite);

/* -------------------------------- chat guest ------------------------------- */

// The invite link is only an entry point: it never grants a session on its own.
publicRouter.post(
  "/chat/verify/request",
  chatVerifyIpLimiter(),
  chatVerifyEmailLimiter(),
  validate({ body: chatVerificationRequestSchema }),
  chatVerifyRequest,
);
publicRouter.post(
  "/chat/verify/confirm",
  chatVerifyConfirmLimiter(),
  validate({ body: chatVerificationConfirmSchema }),
  chatVerifyConfirm,
);

publicRouter.post("/chat/join", chatJoinLimiter(), chatJoin);
publicRouter.post("/chat/logout", chatLogout);

// Media now goes browser -> Cloudinary with an admin signature, so a visitor
// upload cannot be signed here. The route answers 501 until chat images get a
// conversation-scoped signing endpoint.
publicRouter.post("/chat/images", chatLimiter(), chatUploadImageUnavailable);
publicRouter.get(
  "/chat/messages",
  chatLimiter(),
  validate({ query: chatMessagesQuerySchema }),
  chatMessages,
);
publicRouter.post(
  "/chat/messages",
  chatLimiter(),
  validate({ body: chatSendSchema }),
  chatSendMessage,
);
publicRouter.post(
  "/chat/seen",
  chatLimiter(),
  validate({ body: chatSeenSchema }),
  chatSeen,
);
