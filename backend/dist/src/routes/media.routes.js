import express, { Router } from "express";
import path from "node:path";
import { notFound } from "../lib/errors.js";
const RESUME_PREFIX = "resume/";
/**
 * Local development only: project images are served from the storage directory
 * with immutable cache headers. The resume is deliberately excluded — it is
 * streamed exclusively through /api/resume/download so its counter and cache
 * headers stay correct.
 */
export const createMediaRouter = (root) => {
    const router = Router();
    const resolvedRoot = path.resolve(root);
    router.use((request, _response, next) => {
        let key;
        try {
            key = decodeURIComponent(request.path).replace(/^\/+/, "");
        }
        catch {
            next(notFound("File not found."));
            return;
        }
        if (key.length === 0 ||
            key.startsWith(RESUME_PREFIX) ||
            key.split("/").some((segment) => segment === ".." || segment.length === 0)) {
            next(notFound("File not found."));
            return;
        }
        next();
    });
    router.use(express.static(resolvedRoot, {
        index: false,
        dotfiles: "deny",
        fallthrough: true,
        immutable: true,
        maxAge: "365d",
        setHeaders: (response) => {
            response.setHeader("X-Content-Type-Options", "nosniff");
        },
    }));
    return router;
};
//# sourceMappingURL=media.routes.js.map