import { randomUUID } from "node:crypto";
import { pinoHttp } from "pino-http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { logger } from "../config/logger.js";

export const requestContext = pinoHttp({
  logger,
  genReqId: (request: IncomingMessage, response: ServerResponse) => {
    const incoming = request.headers["x-request-id"];
    const id =
      (Array.isArray(incoming) ? incoming[0] : incoming)?.slice(0, 100) ||
      randomUUID();
    response.setHeader("x-request-id", id);
    return id;
  },
  customLogLevel: (_request, response, error) => {
    if (error || response.statusCode >= 500) return "error";
    if (response.statusCode >= 400) return "warn";
    return "info";
  },
  customSuccessMessage: (request, response) =>
    `${request.method ?? "?"} ${request.url ?? ""} ${response.statusCode}`,
  serializers: {
    req: (request) => ({
      id: request.id,
      method: request.method,
      url: request.url,
      remoteAddress: request.remoteAddress,
    }),
    res: (response) => ({ statusCode: response.statusCode }),
  },
});
