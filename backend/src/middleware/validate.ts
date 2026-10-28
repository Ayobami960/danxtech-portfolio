import type { RequestHandler } from "express";
import type { ZodType } from "zod";

type ValidationSchemas = {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
};

/**
 * Parses the declared request parts and stores the results on
 * `request.validated`. Express 5 makes `req.query` a getter, so controllers
 * read validated query/params through the typed accessors instead of mutating
 * the request.
 */
export const validate =
  (schemas: ValidationSchemas): RequestHandler =>
  (request, _response, next) => {
    try {
      request.validated = {
        body: schemas.body ? schemas.body.parse(request.body ?? {}) : {},
        query: schemas.query ? schemas.query.parse(request.query ?? {}) : {},
        params: schemas.params ? schemas.params.parse(request.params ?? {}) : {},
      };
      next();
    } catch (error) {
      next(error);
    }
  };
