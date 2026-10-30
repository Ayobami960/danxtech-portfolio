import { asyncHandler } from "../lib/async-handler.js";
import {
  body as readBody,
  params,
  query,
} from "../lib/request.js";
import type {
  DocumentDeleteParams,
  DocumentDeleteQuery,
} from "../schemas/document.schemas.js";
import type { SignedUploadResult } from "../lib/uploads.js";
import {
  deleteUploadedDocument,
  uploadPortfolioDocument,
} from "../services/document.service.js";

/**
 * POST /api/v1/admin/documents
 * Body: { url: string, publicId: string } — returned by the signed upload flow.
 * The backend never sees the file bytes.
 */
export const uploadDocument = asyncHandler(async (request, response) => {
  const input = readBody<SignedUploadResult>(request);
  response.status(201).json(await uploadPortfolioDocument(request, input));
});

/**
 * DELETE /api/v1/admin/documents/:fileId?key=documents/2026/<id>.pdf
 * Removes an upload that was never attached to a project.
 */
export const deleteDocument = asyncHandler(async (request, response) => {
  const { fileId } = params<DocumentDeleteParams>(request);
  const { key } = query<DocumentDeleteQuery>(request);
  await deleteUploadedDocument(request, { fileId, key });
  response.status(204).end();
});
