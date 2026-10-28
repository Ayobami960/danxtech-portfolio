import express, { type Express } from "express";
import compression from "compression";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import { API_PREFIX } from "./config/constants.js";
import { env } from "./config/env.js";
import {
  contentVersionHandler,
  streamContentEvents,
} from "./controllers/events.controller.js";
import { errorHandler } from "./middleware/error.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { requestContext } from "./middleware/request-context.js";
import { apiRouter } from "./routes/index.js";
import { createMediaRouter } from "./routes/media.routes.js";

/**
 * Allowlist only the configured frontend origins. Requests without an Origin
 * header (curl, server-side fetch, same-origin) are not browser-enforced and
 * pass through; a disallowed browser origin simply receives no CORS headers.
 */
const corsOrigin = (
  origin: string | undefined,
  callback: (error: Error | null, allow?: boolean) => void,
): void => {
  if (!origin) {
    callback(null, true);
    return;
  }
  callback(null, env.frontendOrigins.includes(origin));
};

export const createApp = (): Express => {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", env.trustProxy);

  app.use(requestContext);

  app.use(
    helmet({
      // Project images are intentionally public and may be embedded by the
      // separately deployed frontend or a CDN.
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );

  app.use(
    cors({
      origin: corsOrigin,
      credentials: true,
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: [
        "Content-Type",
        "Authorization",
        "X-CSRF-Token",
        "X-Request-Id",
      ],
      exposedHeaders: ["ETag", "X-Request-Id", "Retry-After"],
      maxAge: 600,
    }),
  );

  app.use(
    compression({
      // EventSource must not be gzipped: compression buffers, which stops
      // events and heartbeats from reaching the browser.
      filter: (request, response) =>
        request.path !== "/api/events" &&
        compression.filter(request, response),
    }),
  );
  app.use(cookieParser());
  app.use(express.json({ limit: "100kb" }));

  // Local development only: the S3 driver serves images from the CDN instead.
  if (env.storage.driver === "local") {
    app.use("/media", createMediaRouter(env.storage.localDir));
  }

  // Connection check: open http://localhost:8000 in the browser.
  app.get("/", (_req, res) => {
    res.json({
      status: "ok",
      service: "portfolio-api",
      env: env.nodeEnv,
      time: new Date().toISOString(),
    });
  });

  // Content-update stream (public): GET /api/events
  app.get("/api/events", streamContentEvents);
  // Polling fallback used when SSE cannot connect.
  app.get("/api/content-version", contentVersionHandler);

  // Same check under the API prefix: http://localhost:8000/api/health
  app.get(`${API_PREFIX}/health`, (_req, res) => {
    res.json({ status: "ok", uptime: Math.round(process.uptime()) });
  });

  app.use(API_PREFIX, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};

/**
 * Vercel's Express preset looks for a default export at app|index|server (or
 * the same names under src/). Exporting the built app here lets a serverless
 * deployment reuse the exact routing stack that server.ts serves, without the
 * long-running wiring (listener, Socket.IO, cron-style jobs) it needs.
 *
 * The server.ts entry imports this instance, so a single app is created per
 * process in both deployment shapes.
 */
const app = createApp();

export default app;
