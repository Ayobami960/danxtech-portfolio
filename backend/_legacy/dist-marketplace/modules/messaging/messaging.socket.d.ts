import type { Server as HttpServer } from "node:http";
/**
 * Creates the single Socket.io server shared by both dashboards. Call it once,
 * after the HTTP server exists. The Redis adapter is used when Redis is
 * connected, so this is safe to run behind multiple API instances.
 */
export declare const initializeMessagingSocket: (httpServer: HttpServer) => Promise<void>;
/** Disconnects every socket and releases the optional Redis adapter clients. */
export declare const shutdownMessagingSocket: () => Promise<void>;
