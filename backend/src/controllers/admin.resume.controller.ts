// admin.resume.controller.ts

import { asyncHandler } from "../lib/async-handler.js";
import {
  body as readBody,
} from "../lib/request.js";
import { readAdminMetadata, removeResume, uploadResume } from "../services/resume.service.js";
import type { SignedUploadResult } from "../lib/uploads.js";

export const getResume = asyncHandler(async (_request, response) => {
  const metadata = await readAdminMetadata();
  response.status(200).json(
    metadata === null ? { available: false } : { available: true, ...metadata },
  );
});
export const putResume = asyncHandler(async (request, response) => {
  const body = readBody<SignedUploadResult>(request);
  response.status(200).json(await uploadResume(request, body));
});
export const deleteResume = asyncHandler(async (request, response) => {
  await removeResume(request);
  response.status(204).end();
});
