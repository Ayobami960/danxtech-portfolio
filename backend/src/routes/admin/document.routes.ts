import type { Router } from "express";
import { uploadDocument, deleteDocument } from "../../controllers/admin.document.controller.js";
import { validate } from "../../middleware/validate.js";
import {
  documentDeleteParams,
  documentDeleteQuery,
} from "../../schemas/document.schemas.js";
import { signedUploadResultSchema } from "../../schemas/project.schemas.js";

export const registerDocumentRoutes = (router: Router): void => {
  // JSON only: the browser uploaded the PDF directly to Cloudinary.
  router.post(
    "/documents",
    validate({ body: signedUploadResultSchema }),
    uploadDocument,
  );

  // `key` scopes the deletion to files this endpoint created (documents/…).
  router.delete(
    "/documents/:fileId",
    validate({ params: documentDeleteParams, query: documentDeleteQuery }),
    deleteDocument,
  );
};
