import app from "./app.js";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { connectDatabase, closeDatabase } from "./db/client.js";
import { startRefreshTokenCleanup } from "./jobs/refresh-token-cleanup.js";
import { startChatHousekeeping } from "./jobs/chat-housekeeping.js";
import { attachChatGateway, closeChatGateway } from "./realtime/gateway.js";
import { initializeMailer } from "./services/mailer.js";
import { scheduleStorageIntegrityCheck } from "./services/storage-integrity.service.js";

const SHUTDOWN_TIMEOUT_MS = 10_000;

/**
 * Long-running entry point (Docker, Render, Fly, a VPS). The app itself lives in
 * app.ts, which is also what Vercel's Express preset imports as a serverless
 * function; Socket.IO, the boot-time jobs and the graceful shutdown below only
 * apply to this shape.
 */
const start = async (): Promise<void> => {
  const server = app.listen(env.port, () => {
    logger.info(
      { port: env.port, nodeEnv: env.nodeEnv, storage: env.storage.driver },
      "Portfolio API listening",
    );
  });

  attachChatGateway(server);

  // Non-blocking: scheduled right after listening, never awaited, so a slow
  // storage provider can neither delay boot nor crash it. Env-gated
  // (STORAGE_INTEGRITY_CHECK) and ImageKit-only.
  scheduleStorageIntegrityCheck();

  // Retries with backoff, which covers a Neon database waking from idle.
  // The server keeps running if it stays unreachable; requests will fail
  // until it recovers, and the pool reconnects on the next query.
  try {
    await connectDatabase();
    logger.info("Database connection verified.");
  } catch (error) {
    logger.error({ err: error }, "Database is unreachable at boot.");
  }

  await initializeMailer();
  const stopCleanup = startRefreshTokenCleanup();
  const stopChatCleanup = startChatHousekeeping();

  let shuttingDown = false;
  const shutdown = (signal: string, exitCode = 0): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "Shutting down");

    stopCleanup();
    stopChatCleanup();
    void closeChatGateway();

    // Safety net: never hang forever on a stuck connection.
    const forceExit = setTimeout(() => {
      logger.error("Graceful shutdown timed out; exiting.");
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    forceExit.unref();

    server.close((error) => {
      void (async () => {
        let failed = Boolean(error);
        if (error) {
          logger.error({ err: error }, "Error while closing the HTTP server");
        }
        try {
          await closeDatabase();
        } catch (dbError) {
          failed = true;
          logger.error({ err: dbError }, "Error while closing the database pool");
        }
        process.exit(failed ? 1 : exitCode);
      })();
    });

    // Drop idle keep-alive sockets so close() doesn't wait on them.
    server.closeIdleConnections();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    logger.error({ err: reason }, "Unhandled promise rejection");
    shutdown("unhandledRejection", 1);
  });

  process.on("uncaughtException", (error) => {
    logger.error({ err: error }, "Uncaught exception");
    shutdown("uncaughtException", 1);
  });
};

start().catch((error: unknown) => {
  logger.fatal({ err: error }, "Failed to start the API");
  process.exit(1);
});
