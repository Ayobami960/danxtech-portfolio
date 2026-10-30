// routes/uploads.routes.ts
import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../lib/async-handler.js";
import { badRequest } from "../lib/errors.js";
import { requireAdmin } from "../middleware/auth.js";
import { requireCsrfForMutations } from "../middleware/csrf.js";
import {
  cloudinaryDeletePublicId,
  isKind,
  signCloudinaryUpload,
} from "../storage/cloudinary.storage.js";

/**
 * Body of `POST /api/v1/uploads/sign`. `kind` picks the Cloudinary preset
 * (folder, public_id, resource type); the browser then uploads the file
 * straight to Cloudinary with the returned signature.
 */
const signBody = z
  .object({
    kind: z.enum(["cover", "gallery", "resume"]),
  })
  .strict();

/**
 * Body of `POST /api/v1/uploads/delete`. `publicId` may be empty: the admin
 * sends it when an asset reference is optional, and an empty value is a no-op
 * rather than an error.
 */
const deleteBody = z
  .object({
    publicId: z.string().trim().max(255),
    resourceType: z.enum(["image", "raw"]).default("image"),
  })
  .strict();

const router = Router();

// Every route here is an authenticated admin mutation. The CSRF check is the
// same double-submit the /api/admin routes use, so the admin client sends
// `x-csrf-token` from the readable CSRF cookie.
router.use(requireAdmin, requireCsrfForMutations);

/**
 * Admin-only. Returns the signature and every preset param as-is, so the client
 * forwards them unchanged or Cloudinary rejects the upload signature.
 */
router.post(
  "/sign",
  asyncHandler(async (request, response) => {
    const parsed = signBody.safeParse(request.body ?? {});
    const kind: unknown = parsed.success ? parsed.data.kind : undefined;

    if (!isKind(kind)) {
      throw badRequest("Invalid upload kind.");
    }

    response.status(200).json(await signCloudinaryUpload(kind));
  }),
);

/**
 * Admin-only. Deletes one Cloudinary object by public_id. Only ids inside this
 * project's `portfolio/` prefix are accepted, so the endpoint can never be used
 * to destroy another tenant's asset.
 */
router.post(
  "/delete",
  asyncHandler(async (request, response) => {
    const parsed = deleteBody.safeParse(request.body ?? {});
    if (!parsed.success) {
      throw badRequest("Invalid delete request.");
    }

    const { publicId, resourceType } = parsed.data;

    // Nothing was uploaded for this slot; deleting it is a no-op, not a failure.
    if (publicId === "") {
      response.status(200).json({ ok: true, skipped: true });
      return;
    }

    if (!publicId.startsWith("portfolio/") || publicId.includes("..")) {
      throw badRequest("publicId must start with portfolio/.");
    }

    const result = await cloudinaryDeletePublicId(publicId, resourceType);
    response.status(200).json({ ok: true, result: result.result });
  }),
);

export { router as uploadsRouter };
