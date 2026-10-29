import express, { type RequestHandler, type Router } from "express";
import {
  MAX_DOCUMENT_BYTES,
  MAX_DOCUMENT_JSON_LIMIT,
} from "../../config/constants.js";
import {
  deleteDocument,
  uploadDocument,
} from "../../controllers/admin.document.controller.js";
import { AppError, ERROR_CODES } from "../../lib/errors.js";
import { validate } from "../../middleware/validate.js";
import {
  documentDeleteParams,
  documentDeleteQuery,
  documentUploadSchema,
} from "../../schemas/document.schemas.js";

const megabyteLabel = (bytes: number): string =>
  `${Math.round(bytes / (1024 * 1024))} MB`;

/**
 * Base64 JSON uploads carry a body far above the app-wide 100 kB JSON limit, so
 * this path installs its own parser (app.ts skips it for that reason). A body
 * over the parser limit is a document over the decoded limit in practice, so it
 * gets the same readable 413 instead of body-parser's generic wording.
 */
const documentJson: RequestHandler = (request, response, next) => {
  express.json({ limit: MAX_DOCUMENT_JSON_LIMIT })(
    request,
    response,
    (error?: unknown) => {
      if ((error as { type?: unknown } | null)?.type === "entity.too.large") {
        next(
          new AppError(
            413,
            ERROR_CODES.PAYLOAD_TOO_LARGE,
            `The document must be ${megabyteLabel(MAX_DOCUMENT_BYTES)} or smaller; a base64 JSON body adds about a third to the file size.`,
          ),
        );
        return;
      }
      next(error);
    },
  );
};

export const registerDocumentRoutes = (router: Router): void => {
  router.post(
    "/documents",
    documentJson,
    validate({ body: documentUploadSchema }),
    uploadDocument,
  );

  // `key` scopes the deletion to files this endpoint created (documents/…).
  router.delete(
    "/documents/:fileId",
    validate({ params: documentDeleteParams, query: documentDeleteQuery }),
    deleteDocument,
  );
};
