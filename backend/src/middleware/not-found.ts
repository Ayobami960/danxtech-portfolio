import type { RequestHandler } from "express";
import { AppError, ERROR_CODES } from "../lib/errors.js";

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(
    new AppError(
      404,
      ERROR_CODES.NOT_FOUND,
      `No route matches ${request.method} ${request.path}.`,
    ),
  );
};
