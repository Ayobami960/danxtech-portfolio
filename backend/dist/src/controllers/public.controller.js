import { env } from "../config/env.js";
import { checkDatabase } from "../db/client.js";
import { asyncHandler } from "../lib/async-handler.js";
import { etagMatches, sendCacheableJson } from "../lib/cache.js";
import { AppError, ERROR_CODES } from "../lib/errors.js";
import { body as readBody, params, query } from "../lib/request.js";
import { submit } from "../services/contact.service.js";
import { readHero } from "../services/hero.service.js";
import { getPublicBySlug, listPublic } from "../services/project.service.js";
import { countDownload, getDownload, readMetadata } from "../services/resume.service.js";
export const health = asyncHandler(async (_request, response) => {
    try {
        await checkDatabase();
    }
    catch {
        throw new AppError(503, ERROR_CODES.SERVICE_UNAVAILABLE, "The database is unavailable.");
    }
    response.status(200).json({
        status: "ok",
        database: "up",
        uptimeSeconds: Math.round(process.uptime()),
        timestamp: new Date().toISOString(),
    });
});
export const hero = (request, response, next) => {
    void readHero()
        .then((payload) => sendCacheableJson(request, response, payload))
        .catch(next);
};
export const projects = asyncHandler(async (request, response) => {
    const { tech } = query(request);
    sendCacheableJson(request, response, await listPublic(tech));
});
export const projectBySlug = asyncHandler(async (request, response) => {
    const { slug } = params(request);
    sendCacheableJson(request, response, await getPublicBySlug(slug));
});
export const submitContact = asyncHandler(async (request, response) => {
    const input = readBody(request);
    const result = await submit(request, input);
    response.status(201).json(result);
});
export const resumeMetadata = asyncHandler(async (_request, response) => {
    // Availability changes the moment a resume is replaced, so never cache it.
    response.setHeader("Cache-Control", "no-store");
    response.status(200).json(await readMetadata());
});
/** Strip anything that could break out of the quoted filename header. */
const safeFileName = (name) => name.replace(/[^\w.\- ]+/g, "_").slice(0, 180) || "resume.pdf";
export const downloadResume = asyncHandler(async (request, response, next) => {
    const { resume, stream } = await getDownload();
    const etag = `"${resume.sha256}"`;
    response.setHeader("ETag", etag);
    response.setHeader("Cache-Control", "public, max-age=300, must-revalidate");
    if (etagMatches(request.get("if-none-match"), etag)) {
        stream.destroy();
        response.status(304).end();
        return;
    }
    const { inline } = query(request);
    const disposition = inline === "1" || inline === "true" ? "inline" : "attachment";
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `${disposition}; filename="${safeFileName(env.resumeDownloadName)}"`);
    response.setHeader("Content-Length", String(resume.sizeBytes));
    if (request.method === "HEAD") {
        stream.destroy();
        response.status(200).end();
        return;
    }
    // A 304 never reaches here, and HEAD returned above, so every counted row
    // corresponds to a real download that starts streaming now.
    await countDownload();
    stream.on("error", (error) => {
        response.destroy();
        if (!response.headersSent) {
            next(error);
        }
    });
    stream.pipe(response);
});
//# sourceMappingURL=public.controller.js.map