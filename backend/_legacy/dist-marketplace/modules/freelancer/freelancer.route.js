import { Router } from "express";
import { authenticate, requireOnboarded, requireRole } from "../../middleware/auth.middleware.js";
import { getFreelancerJobDetails, getFreelancerJobFeed, getLoggedInFreelancerProfileHandler, getPublicFreelancer, upsertFreelanceProfile, } from "./freelancer.controller.js";
export const freelancerRouter = Router();
// Any signed-in, onboarded user (clients included) can view a public profile.
freelancerRouter.get("/profile/:id", authenticate, requireOnboarded, getPublicFreelancer);
// Everything below is freelancer-only.
freelancerRouter.use(authenticate, requireRole("freelancer"));
freelancerRouter.get("/profile", getLoggedInFreelancerProfileHandler);
freelancerRouter.put("/profile", upsertFreelanceProfile);
freelancerRouter.get("/jobs", getFreelancerJobFeed);
freelancerRouter.get("/jobs/:id", getFreelancerJobDetails);
//# sourceMappingURL=freelancer.route.js.map