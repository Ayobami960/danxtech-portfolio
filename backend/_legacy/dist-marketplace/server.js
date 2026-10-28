/// <reference path="./types/express.d.ts" />
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createServer } from "node:http";
import { API_PREFIX, SERVICE_NAME } from "./config/constants.js";
import { env, isAllowedOrigin } from "./config/env.js";
import { ApiError } from "./utils/api-error.js";
import { apiRouter } from "./routes/index.js";
import { notFoundHandler } from "./middleware/not-found-middleware.js";
import { errorHandler } from "./middleware/error.middleware.js";
import { connectRedis, disconnectRedis } from "./config/redis.js";
import { connectDatabase, disconnectDatabase } from "./database/clients.js";
import { verifyMailer } from "./modules/auth/mailer.js";
import { disconnectNats } from "./config/nats.js";
import { startNotificationConsumer, stopNotificationConsumer } from "./events/consumer.js";
import { startConnectsReconciliation } from "./modules/connects/connects.scheduler.js";
import { initializeMessagingSocket, shutdownMessagingSocket, } from "./modules/messaging/messaging.socket.js";
const isVercel = process.env.VERCEL === "1";
const SHUTDOWN_TIMEOUT_MS = 10_000;
/* -------------------------------------------------------------------------- */
/*                                Express app                                 */
/* -------------------------------------------------------------------------- */
const app = express();
app.disable("x-powered-by");
// Vercel terminates TLS and forwards the client address in X-Forwarded-For.
// Without this, every request shares the proxy IP, so the per-IP rate limiters
// (login, OTP) would lock out all users at once in production.
app.set("trust proxy", 1);
// Stripe needs the untouched raw body for signature verification. Both spellings
// are registered because the Stripe CLI command in Read.md forwards to
// /connects/webhooks while the router serves /connects/webhook.
app.use([`${API_PREFIX}/connects/webhook`, `${API_PREFIX}/connects/webhooks`], express.raw({ type: "application/json" }));
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || isAllowedOrigin(origin)) {
            callback(null, true);
            return;
        }
        // A browser origin that is not configured is a deployment problem,
        // not a server bug: log one actionable line and answer 403 instead
        // of an unhandled error that surfaces as a 500 with a stack trace.
        console.warn(`Blocked CORS origin "${origin}". Add it to ORIGINS_* or API_ALLOWED_ORIGINS.`);
        callback(new ApiError(403, `Origin ${origin} is not allowed. Add it to ORIGINS_* or API_ALLOWED_ORIGINS.`));
    },
    credentials: true,
    // PATCH is used by the dashboards (proposal status, notification read).
    // Leaving it out let the preflight answer 204 without advertising PATCH,
    // which makes the browser block the real request.
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
}));
app.use(helmet());
// Messages may carry up to five 5 MB files as base64 data URLs (~7 MB each
// once encoded), which is far above the default API body limit. The messaging
// controller still enforces the per-file and per-message limits; this only
// lets a valid request reach it.
app.use(`${API_PREFIX}/conversations`, express.json({ limit: "40mb" }));
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true }));
/* -------------------------------------------------------------------------- */
/*                              Services lifecycle                            */
/* -------------------------------------------------------------------------- */
let server;
let connectsReconcileTimer;
let isShuttingDown = false;
let servicesReady;
/**
 * Connects the database (required) and Redis (optional).
 * Memoized so it only runs once, whether called at startup or lazily on Vercel.
 */
const initServices = () => {
    servicesReady ??= (async () => {
        await verifyMailer();
        // The database is required: fail fast if it cannot be reached.
        await connectDatabase();
        // Redis is optional: the service degrades gracefully without the auth cache.
        if (process.env.REDIS_HOST) {
            try {
                await connectRedis();
            }
            catch (error) {
                console.warn("Redis is unavailable; continuing without auth cache.", error);
            }
        }
        else {
            console.info("REDIS_HOST is not configured; continuing without auth cache.");
        }
    })().catch((error) => {
        servicesReady = undefined; // allow a retry on the next request
        throw error;
    });
    return servicesReady;
};
// On Vercel there is no start() call, so connect lazily on the first request.
if (isVercel) {
    app.use(async (_request, _response, next) => {
        try {
            await initServices();
            next();
        }
        catch (error) {
            next(error);
        }
    });
}
/* -------------------------------------------------------------------------- */
/*                                   Routes                                   */
/* -------------------------------------------------------------------------- */
app.get("/", (_request, response) => {
    response.status(200).json({
        status: "ok",
        service: SERVICE_NAME,
    });
});
app.use(API_PREFIX, apiRouter);
app.use(notFoundHandler);
app.use(errorHandler);
/* -------------------------------------------------------------------------- */
/*                         HTTP server (non-Vercel only)                      */
/* -------------------------------------------------------------------------- */
/**
 * Starts the HTTP server and resolves once it is actually listening.
 * Rejects on listen errors such as EADDRINUSE instead of failing silently.
 */
const startHttpServer = () => new Promise((resolve, reject) => {
    const instance = createServer(app);
    instance.once("error", reject);
    instance.listen(env.port, () => {
        instance.off("error", reject);
        console.log(`${SERVICE_NAME} listening on http://localhost:${env.port} in ${env.nodeEnv} mode`);
        resolve(instance);
    });
});
/**
 * Stops accepting new connections and lets in-flight requests finish.
 */
const closeHttpServer = () => new Promise((resolve, reject) => {
    if (!server) {
        resolve();
        return;
    }
    server.close((error) => {
        if (error) {
            reject(error);
            return;
        }
        resolve();
    });
    // Drop idle keep-alive sockets so close() doesn't wait on them.
    server.closeIdleConnections();
});
const start = async () => {
    await initServices();
    if (isShuttingDown)
        return;
    server = await startHttpServer();
    // One Socket.io server serves both dashboards.
    await initializeMessagingSocket(server);
    // NATS is optional for serving HTTP; don't crash the API if it's down.
    try {
        await startNotificationConsumer();
    }
    catch (error) {
        console.warn("Notification consumer failed to start.", error);
    }
    // Safety net for Connects purchases whose Stripe webhook never arrived.
    // Serverless hosts run the same work from POST /connects/reconcile instead.
    connectsReconcileTimer = startConnectsReconciliation();
};
const shutdown = async (reason, exitCode = 0) => {
    if (isShuttingDown) {
        return;
    }
    isShuttingDown = true;
    if (connectsReconcileTimer) {
        clearInterval(connectsReconcileTimer);
        connectsReconcileTimer = undefined;
    }
    console.log(`${reason}. Closing services.`);
    // Safety net: never hang forever on a stuck connection.
    const forceExitTimer = setTimeout(() => {
        console.error("Shutdown timed out; forcing exit.");
        process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExitTimer.unref();
    let failed = false;
    try {
        await shutdownMessagingSocket();
    }
    catch (error) {
        failed = true;
        console.error("Failed to close the messaging socket.", error);
    }
    try {
        await closeHttpServer();
    }
    catch (error) {
        failed = true;
        console.error("Failed to close HTTP server.", error);
    }
    // 1. Stop consuming and flush buffered notifications (needs DB + NATS alive).
    try {
        await stopNotificationConsumer();
    }
    catch (error) {
        failed = true;
        console.error("Failed to stop notification consumer.", error);
    }
    // 2. Now the independent resources can close together. Independent resources: close together so one failure doesn't block the other.
    const results = await Promise.allSettled([
        disconnectDatabase(),
        disconnectNats(),
        disconnectRedis(),
    ]);
    for (const result of results) {
        if (result.status === "rejected") {
            failed = true;
            console.error("Failed to disconnect a service.", result.reason);
        }
    }
    process.exit(failed ? 1 : exitCode);
};
if (!isVercel) {
    process.on("SIGINT", () => void shutdown("SIGINT received"));
    process.on("SIGTERM", () => void shutdown("SIGTERM received"));
    process.on("unhandledRejection", (reason) => {
        console.error("Unhandled promise rejection.", reason);
        void shutdown("Unhandled rejection", 1);
    });
    process.on("uncaughtException", (error) => {
        console.error("Uncaught exception.", error);
        void shutdown("Uncaught exception", 1);
    });
    start().catch((error) => {
        console.error(`Failed to start ${SERVICE_NAME}.`, error);
        void shutdown("Startup failure", 1);
    });
}
// Vercel detects the Express app through this default export.
export default app;
export { app };
//# sourceMappingURL=server.js.map