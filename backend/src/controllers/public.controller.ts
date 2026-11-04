import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { checkDatabase } from "../db/client.js";
import { asyncHandler } from "../lib/async-handler.js";
import { etagMatches, sendCacheableJson } from "../lib/cache.js";
import { AppError, ERROR_CODES } from "../lib/errors.js";
import { body as readBody, params, query } from "../lib/request.js";
import type { ContactSubmission } from "../schemas/contact.schemas.js";
import { submit } from "../services/contact.service.js";
import { readHero } from "../services/hero.service.js";
import { getPublicBySlug, listPublic } from "../services/project.service.js";
import { countDownload, getDownload, readMetadata } from "../services/resume.service.js";

export const health = asyncHandler(async (_request, response) => {
  try {
    await checkDatabase();
  } catch {
    throw new AppError(
      503,
      ERROR_CODES.SERVICE_UNAVAILABLE,
      "The database is unavailable.",
    );
  }

  response.status(200).json({
    status: "ok",
    database: "up",
    uptimeSeconds: Math.round(process.uptime()),
    timestamp: new Date().toISOString(),
  });
});

export const hero: RequestHandler = (request, response, next) => {
  void readHero()
    .then((payload) => sendCacheableJson(request, response, payload))
    .catch(next);
};

export const projects = asyncHandler(async (request, response) => {
  const { tech } = query<{ tech?: string }>(request);
  sendCacheableJson(request, response, await listPublic(tech));
});

export const projectBySlug = asyncHandler(async (request, response) => {
  const { slug } = params<{ slug: string }>(request);
  sendCacheableJson(request, response, await getPublicBySlug(slug));
});

export const submitContact = asyncHandler(async (request, response) => {
  const input = readBody<ContactSubmission>(request);
  const result = await submit(request, input);
  response.status(201).json(result);
});

export const resumeMetadata = asyncHandler(async (_request, response) => {
  // Availability changes the moment a resume is replaced, so never cache it.
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json(await readMetadata());
});

/** Strip anything that could break out of the quoted filename header. */
const safeFileName = (name: string): string =>
  name.replace(/[^\w.\- ]+/g, "_").slice(0, 180) || "resume.pdf";

export const downloadResume = asyncHandler(async (request, response, next) => {
  const source = await getDownload();
  const { inline } = query<{ inline?: "1" | "true" | "0" | "false" }>(request);
  const disposition = inline === "1" || inline === "true" ? "inline" : "attachment";
  const contentDisposition = `${disposition}; filename="${safeFileName(env.resumeDownloadName)}"`;

  // The resume URL is stable (the admin's link carries no version query) and
  // the file is replaced in place when a new PDF is uploaded, so any cache
  // would keep serving the old or deleted PDF after a replacement. Every
  // download therefore reads the current row and streams fresh bytes.
  response.setHeader("Cache-Control", "no-store");

  // Legacy non-Cloudinary rows: hand the browser the delivery URL directly.
  if (source.kind === "url") {
    if (request.method !== "HEAD") {
      await countDownload();
    }
    response.redirect(302, source.url);
    return;
  }

  // Cloudinary-hosted rows: public raw PDF delivery is blocked on accounts
  // that restrict PDF/ZIP delivery, so fetch the asset through Cloudinary's
  // authenticated download endpoint and stream the bytes from this origin.
  // The signed URL (and API credentials) never reach the browser.
  if (source.kind === "signed") {
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", contentDisposition);

    if (request.method === "HEAD") {
      response.status(200).end();
      return;
    }

    let bytes: Buffer;
    try {
      const upstream = await fetch(source.url, {
        signal: AbortSignal.timeout(15_000),
      });
      if (!upstream.ok) {
        throw new Error(`Cloudinary download failed with status ${upstream.status}.`);
      }
      bytes = Buffer.from(await upstream.arrayBuffer());
    } catch {
      throw new AppError(
        502,
        ERROR_CODES.SERVICE_UNAVAILABLE,
        "The resume could not be downloaded right now. Please try again.",
      );
    }

    response.setHeader("Content-Length", String(bytes.byteLength));
    await countDownload();
    response.end(bytes);
    return;
  }

  const { resume, stream } = source;
  const etag = `"${resume.sha256 ?? ""}"`;
  response.setHeader("ETag", etag);

  if (etagMatches(request.get("if-none-match"), etag)) {
    stream.destroy();
    response.status(304).end();
    return;
  }

  response.setHeader("Content-Type", "application/pdf");
  response.setHeader("Content-Disposition", contentDisposition);
  response.setHeader("Content-Length", String(resume.sizeBytes ?? 0));

  if (request.method === "HEAD") {
    stream.destroy();
    response.status(200).end();
    return;
  }

  // A 304 never reaches here, and HEAD returned above, so every counted row
  // corresponds to a real download that starts streaming now.
  await countDownload();

  stream.on("error", (error: Error) => {
    response.destroy();
    if (!response.headersSent) {
      next(error);
    }
  });
  stream.pipe(response);
});
