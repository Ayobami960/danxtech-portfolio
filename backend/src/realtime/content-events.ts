import type { Response } from "express";
import { logger } from "../config/logger.js";

/**
 * Public entity names carried by content-update events. They match the public
 * client's content sections. Nothing except the entity name and a timestamp
 * ever leaves this module.
 */
export const CONTENT_ENTITIES = [
  "hero",
  "about",
  "projects",
  "experience",
  "skills",
  "security",
  "credentials",
  "siteSettings",
  "resume",
] as const;

export type ContentEntity = (typeof CONTENT_ENTITIES)[number];

type ContentUpdateEvent = {
  type: "content-updated";
  entity: ContentEntity;
  at: string;
};

const HEARTBEAT_MS = 25_000;

/** Open SSE connections. Process-local: see `broadcastContentUpdate`. */
const clients = new Set<Response>();

/**
 * Monotonic version for the polling fallback. The boot id makes a value from
 * a previous process distinguishable after a restart.
 */
const bootId = Date.now().toString(36);
let sequence = 0;
let version = `${bootId}:0`;

const heartbeat = setInterval(() => {
  for (const client of clients) {
    try {
      client.write(": heartbeat\n\n");
    } catch {
      clients.delete(client);
    }
  }
}, HEARTBEAT_MS);

// Never keep the process alive just for the heartbeat.
heartbeat.unref();

const write = (client: Response, frame: string): void => {
  try {
    client.write(frame);
  } catch {
    clients.delete(client);
  }
};

export const contentVersion = (): string => version;

/** Register a connection; the route removes it again on `close`. */
export const addEventClient = (response: Response): void => {
  clients.add(response);
  // EventSource reconnects after two seconds instead of the ten-second default.
  response.write("retry: 2000\n\n");
  response.write(": connected\n\n");
};

export const removeEventClient = (response: Response): void => {
  clients.delete(response);
};

/**
 * Announce a content change to every connected public client.
 *
 * Call this only after the database write and the client cache revalidation
 * have completed, never before. Broadcasting first would make a client refetch
 * the RSC payload that is still cached and show the old content.
 *
 * With more than one API instance this in-memory set only reaches the clients
 * connected to the same process; the next step would be Postgres
 * LISTEN/NOTIFY or Redis pub/sub.
 */
export const broadcastContentUpdate = (entity: ContentEntity): void => {
  sequence += 1;
  version = `${bootId}:${sequence}`;

  const event: ContentUpdateEvent = {
    type: "content-updated",
    entity,
    at: new Date().toISOString(),
  };
  const frame = `data: ${JSON.stringify(event)}\n\n`;

  for (const client of clients) write(client, frame);
  logger.debug({ entity, clients: clients.size }, "Broadcast content update");
};
