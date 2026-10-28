import { Router } from "express";
import { SERVICE_NAME } from "../config/constants.js";
import { authRouter } from "../modules/auth/auth.route.js";
import { connectDatabase } from "../database/clients.js";
import { clientRouter } from "../modules/clients/client.route.js";
import { freelancerRouter } from "../modules/freelancer/freelancer.route.js";
import { jobRouter } from "../modules/jobs/jobs.route.js";
import { uploadRouter } from "../modules/upload/upload.route.js";
import { connectsRouter } from "../modules/connects/connects.route.js";
import { notificationRouter } from "../modules/notifications/notification.route.js";
import { proposalRouter } from "../modules/proposals/proposals.route.js";
import { messagingRouter } from "../modules/messaging/messaging.route.js";
import { agencyRouter } from "../modules/agency/agency.route.js";
import { adminRouter } from "../modules/admin/admin.route.js";
import { contractsRouter } from "../modules/contracts/contracts.route.js";
import { identityRouter } from "../modules/identity/identity.route.js";
import { meetingsRouter } from "../modules/meetings/meetings.route.js";
export const apiRouter = Router();
apiRouter.use("/auth", authRouter);
apiRouter.use("/client", clientRouter);
apiRouter.use("/upload", uploadRouter);
apiRouter.use("/connects", connectsRouter);
apiRouter.use("/freelancer", freelancerRouter);
apiRouter.use("/jobs", jobRouter);
apiRouter.use("/notifications", notificationRouter);
apiRouter.use("/proposals", proposalRouter);
apiRouter.use("/conversations", messagingRouter);
apiRouter.use("/agency", agencyRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/contracts", contractsRouter);
apiRouter.use("/identity", identityRouter);
apiRouter.use("/meetings", meetingsRouter);
apiRouter.get("/", async (_request, response) => {
    let database = "connected";
    try {
        await connectDatabase();
    }
    catch (error) {
        database = "unavailable";
        console.error("Database health check failed.", error);
    }
    const body = {
        success: true,
        message: "service is healthy.",
        data: {
            service: SERVICE_NAME,
            status: database === "connected" ? "healthy" : "degraded",
            database,
            timestamp: new Date().toDateString(),
        },
    };
    response.status(database === "connected" ? 200 : 503).json(body);
});
//# sourceMappingURL=index.js.map