import type { Request } from "express";
import type { AdminUser } from "../database/schema.js";
import { AppError, ERROR_CODES } from "./errors.js";

export const body = <T>(request: Request): T => request.validated.body as T;

export const query = <T>(request: Request): T =>
  request.validated.query as T;

export const params = <T>(request: Request): T =>
  request.validated.params as T;

export const currentAdmin = (request: Request): AdminUser => {
  if (!request.admin) {
    throw new AppError(
      401,
      ERROR_CODES.UNAUTHORIZED,
      "Authentication required.",
    );
  }
  return request.admin;
};
