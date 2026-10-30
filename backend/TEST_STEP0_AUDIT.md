// Step 0 audit summary — backend contract for file uploads

## What the backend actually has today

- No Cloudinary package installed. `backend/package.json` only has `imagekit` as a storage dependency.
- No `cloudinary` imports anywhere in `backend/src`.
- No `CLOUDINARY_*` env vars referenced anywhere in the backend.
- The only active storage driver is `CloudinaryStorage` in `backend/src/storage/cloudinary.storage.ts` (ImageKit driver file is now intentionally empty).
- `backend/src/storage/index.ts` exports `getStorage()` returning `CloudinaryStorage`, plus `publicMediaUrl()` and `deleteStoredFile()`.
- `backend/src/storage/types.ts` defines `StorageDriver` and `StoredFile` (key / url / fileId).
- `backend/src/config/env.ts` validates/clouds `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` (plus optional `CLOUDINARY_DELIVERY_URL`) into `env.cloudinary`.

So the premise in the task ("backend ALREADY uses Cloudinary") is not true for this codebase. The backend is still on ImageKit. The ImageKit integration itself was recently fixed (the session before this one was about ImageKit returning 500s).

## Existing upload surface (backend routes/modules)

- Project cover: `POST /api/v1/admin/projects/:id/cover` (multipart, `file` field) — `project.service.ts` `setCover()`. Server-side ImageKit upload via `storage.put(...)`. Returns the admin-shaped project.
- Project gallery: `POST /api/v1/admin/projects/:id/gallery` (multipart, `files` field) — `project.service.ts` `addGalleryImages()`. Server-side ImageKit upload.
- Project gallery delete: `DELETE /api/v1/admin/projects/:id/gallery/:imageId` — `project.service.ts` `removeGalleryImage()`. Deletes the DB row then calls `deleteStoredFile(...)`.
- Project document (PDF): `POST /api/v1/admin/documents` (base64 JSON body `dataUrl` + `fileName`) — `document.service.ts` `uploadPortfolioDocument()`. Server-side ImageKit upload into `documents/<year>/<uuid>.pdf`. Returns `{ fileId, key, url, name, mimeType, sizeBytes }`.
- Project document delete: `DELETE /api/v1/admin/documents/:fileId?key=...` — `document.service.ts` `deleteUploadedDocument()`. Refuses if the doc is still attached to a project.
- Resume (PDF): `POST /api/v1/admin/resume` (multipart, `file` field) — `resume.service.ts` `uploadResume()`. Replaces the singleton resume row in Postgres. Previous storage key is deleted after the write.
- Resume delete: `DELETE /api/v1/admin/resume` — `resume.service.ts` `removeResume()`.

Auth: the admin routes live under `/api/v1/admin` behind the backend's admin auth middleware (session cookies + CSRF). Public routes (`/api/v1/projects`, `/api/v1/resume`, etc.) are unauthenticated.

## How data is stored today

Project table (schema.ts):
- `coverImage` (text), `coverFileId` (text), `coverStorageKey` (text), plus originalName/mimeType/sizeBytes/sha256.
- `documentUrl`, `documentFileId`, `documentStorageKey`, `documentName`, `documentSizeBytes`.
- gallery: `project_images` table with `url`, `fileId`, `storageKey`, plus metadata and `sortOrder`.

So today the model is `{ url, fileId, storageKey }`, not `{ url, publicId }`. That matters for the migration: Cloudinary's delete primitive is `public_id`, not `fileId`. If we want per-asset Cloudinary deletes we must store `publicId` somewhere.

`publicMediaUrl()` resolves `storageKey` back to a URL via the driver. Legacy rows without a key are served as-is (or from `external/`). That helper is the source of truth for displayed URLs today.

## Delete / replace behavior today

- Cover replace (`setCover`): uploads new image, writes DB, then deletes old cover via `deleteStoredFile({ fileId, key })` (ImageKit by fileId or key). No separate frontend delete call.
- Gallery add/remove/reorder: handled by service functions. Removal already deletes the stored file server-side.
- Project document attach/remove: attach writes fileId/key/url; removal on project update deletes the stored file server-side.
- Resume replace: upserts the DB row, then deletes the previous storage key server-side.
- Project delete: `remove()` deletes the DB row, then iterates cover + document + gallery images and calls `deleteStoredFile` with `fileId`/`key`, skipping `external/` keys. This is the cleanup path on project delete.

So the backend already does delete/replace server-side. There is no frontend "delete this Cloudinary asset" route today, but there is a backend delete capability through the storage driver.

## Validation today

- Images: `MAX_IMAGE_BYTES = 4 MB`, `MAX_IMAGE_REQUEST_BYTES = 4.5 MB` (Vercel body cap guard), max gallery `MAX_GALLERY_IMAGES = 10`. Re-encoding to WebP happens in `image.service.ts`.
- Resume: `MAX_RESUME_BYTES = 25 MB`, PDF magic-byte check via `pdf.service.ts` `assertPdf()`.
- Project document (base64): `MAX_DOCUMENT_BYTES = 3 MB` decoded, only `application/pdf`, parsed via `data-url.ts`.
- JSON body parser limited to 100kb globally; document route uses its own larger parser limit (`MAX_DOCUMENT_JSON_LIMIT = 4_300_000`).

## CORS today

`backend/src/app.ts`:
- `corsOrigin` allowlists origins from `env.frontendOrigins` (derived from `FRONTEND_ORIGIN_CLIENT` + `FRONTEND_ORIGIN_ADMIN`).
- `credentials: true`.
- Allowed headers include `Content-Type`, `Authorization`, `X-CSRF-Token`, `X-Request-Id`.
- If `env.frontendOrigins` does not yet include `http://localhost:5173` (Vite dev) or the deployed admin origin, browser requests from the admin will be blocked.

## Gaps found (relevant to the Cloudinary migration)

1. No Cloudinary code at all. The task assumes an existing Cloudinary backend; there is none. We are migrating from ImageKit to Cloudinary.
2. No signed-upload endpoint today. All uploads go through the server (multipart or base64). On Vercel serverless, server-received multipart is bounded by the ~4.5MB request body limit; the 4MB image cap already sits under that, but large gallery uploads or resume uploads are the risky ones.
3. Storage model is `fileId`/`storageKey`, not `publicId`. Cloudinary deletes need `public_id`. Either we store Cloudinary `public_id` per asset, or we rely on Cloudinary's destroy-by-url/path lookups (slower/less precise). For a clean migration, store `publicId`.
4. `StorageDriver` interface is ImageKit-flavored (`getStream`, `publicUrl(key)`, `delete(key)`, `deleteById(fileId)`). We need a Cloudinary driver and a way to switch/ dual-run during migration.
5. Env layer still requires ImageKit vars in production. We need to add Cloudinary env and switch the boot validation.
6. `publicMediaUrl` and URL helpers assume ImageKit endpoints; Cloudinary URLs look different (`res.cloudinary.com/.../upload/...`). Display helpers will need to handle both during the legacy transition.
7. Admin frontend still has ImageKit-flavored upload code and types; it must be rewired to the new backend contract.

## What I would do next (my plan)

- Add `cloudinary` npm package to backend.
- Add Cloudinary env (`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, optional `CLOUDINARY_DELIVERY_URL`) to env validation; keep ImageKit vars only as long as legacy URLs exist, then they can be removed.
- Add a Cloudinary storage driver implementing `StorageDriver`, and a signed-upload endpoint (`POST /api/v1/admin/uploads/sign`, admin auth) returning `{ signature, timestamp, apiKey, cloudName, resourceType, params }` plus a delete endpoint if we want frontend-deletable assets.
- Decide upload strategy:
  - Images: browser direct upload to `api.cloudinary.com/v1_1/<cloud>/image/upload` with signed params (avoids Vercel body limit entirely).
  - Resume: also direct upload to Cloudinary raw upload with fixed `public_id = resume.pdf`, overwrite + invalidate. OR keep server-receive since resume is 25MB-cap and Vercel body limit is the constraint; if direct, we avoid that limit too.
- Store Cloudinary `public_id` on project cover, gallery images, and (for the resume) only if we keep it in storage; today the resume lives in Postgres bytes, so Cloudinary public_id deletion only matters if we store the resume in Cloudinary. Today resume is in DB, so "resume PDF" migration is really about where the bytes live.
- Update `publicMediaUrl`/display helpers to emit Cloudinary URLs, with legacy ImageKit URL passthrough.
- Update admin frontend API types/client/forms to talk to the new signed-upload/delete endpoints and to send/receive `publicId` where relevant.
- Remove ImageKit package, config, env vars, helpers, and leftover ImageKit comments/strings from backend and admin.
- Add a Cloudinary image URL optimization helper (`f_auto,q_auto`, optional `w_`) and apply in public portfolio + admin previews; leave non-Cloudinary legacy URLs untouched.

## One important note on resume

Today the resume PDF bytes live in PostgreSQL, not in ImageKit/Cloudinary. The `resume.download` route streams from DB. If we move resume storage to Cloudinary instead, that is a bigger change than images, and it changes the download endpoint. If we keep resume in DB but also upload to Cloudinary for delivery, we have two sources of truth. The cleanest route depends on whether you want the resume delivered from Cloudinary (CDN) or still from the API/DB. I would confirm that before touching resume storage.

## Bottom line for Step 0

The task's premise was not correct for this repo at the start of the migration: there was no existing Cloudinary backend. The real backend was ImageKit-based, with server-received multipart + base64 uploads, admin auth, server-side delete/replace, and a `fileId`/`storageKey` storage model. Migration to Cloudinary meant adding a Cloudinary driver + signed upload flow, adding Cloudinary env, storing `publicId`, rewiring the admin, removing ImageKit, and updating display helpers. The admin must be adapted to the backend we build, not to a Cloudinary backend that does not exist yet.
