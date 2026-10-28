import { Router } from "express";
import { createProposal, getProposalMetadata, getProposals, interviewProposal, updateProposalStatus } from "./proposals.controller.js";
import { authenticate } from "../../middleware/auth.middleware.js";
export const proposalRouter = Router();
proposalRouter.use(authenticate);
proposalRouter.get("/", getProposals);
proposalRouter.get("/metadata", getProposalMetadata);
proposalRouter.post("/", createProposal);
proposalRouter.patch("/:proposalId/status", updateProposalStatus);
proposalRouter.post("/:proposalId/interview", interviewProposal);
//# sourceMappingURL=proposals.route.js.map