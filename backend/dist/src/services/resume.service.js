import { Readable } from "node:stream";
import { AppError, ERROR_CODES, notFound } from "../lib/errors.js";
import { logger } from "../config/logger.js";
import { sha256Hex } from "../lib/crypto.js";
import { deleteResume, getResume, getResumeDocument, incrementResumeDownloadCount, upsertResume, } from "../repositories/resume.repository.js";
import { audit } from "../repositories/audit-writer.js";
import { REVALIDATE_TAGS } from "../config/constants.js";
import { contentUpdated } from "./revalidate.service.js";
import { getStorage } from "../storage/index.js";
import { assertPdf } from "./pdf.service.js";
/** The version query busts the PDF cache after a replacement. */
export const resumeDownloadUrl = (updatedAt) => `/api/v1/resume/download?v=${updatedAt.getTime()}`;
export const toPublicMetadata = (resume) => {
    if (!resume)
        return { available: false };
    return {
        available: true,
        fileName: resume.originalName,
        sizeBytes: resume.sizeBytes,
        updatedAt: resume.updatedAt,
        downloadUrl: resumeDownloadUrl(resume.updatedAt),
    };
};
export const readMetadata = async () => toPublicMetadata(await getResume());
export const readAdminMetadata = async () => {
    const resume = await getResume();
    if (!resume)
        return null;
    return {
        id: resume.id,
        fileName: resume.originalName,
        mimeType: resume.mimeType,
        sizeBytes: resume.sizeBytes,
        downloadCount: resume.downloadCount,
        uploadedAt: resume.uploadedAt,
        updatedAt: resume.updatedAt,
    };
};
/**
 * Safe replacement flow:
 *   1. validate the magic bytes
 *   2. write the bytes to the singleton row (one transaction)
 *   3. only then delete the previous ImageKit object, if the row predates the
 *      move to PostgreSQL
 * Any failure before (2) leaves the old resume intact.
 */
export const uploadResume = async (request, file) => {
    if (!file) {
        throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, "A PDF file is required in the `file` field.");
    }
    assertPdf(file.buffer, file.originalname);
    const previous = await getResume();
    const saved = await upsertResume({
        data: file.buffer,
        originalName: file.originalname.slice(0, 255) || "resume.pdf",
        mimeType: "application/pdf",
        sizeBytes: file.size,
        sha256: sha256Hex(file.buffer),
    });
    if (previous?.storageKey) {
        await getStorage()
            .delete(previous.storageKey)
            .catch((error) => {
            logger.warn({ err: error, key: previous.storageKey }, "Failed to delete the legacy resume file");
        });
    }
    await audit(request, {
        action: "resume.upload",
        entity: "resume",
        entityId: "resume",
        meta: { sizeBytes: saved.sizeBytes },
    });
    contentUpdated("resume", [...REVALIDATE_TAGS.resume]);
    return toPublicMetadata(saved);
};
export const removeResume = async (request) => {
    const removed = await deleteResume();
    if (!removed)
        throw notFound("No resume exists.");
    await audit(request, {
        action: "resume.delete",
        entity: "resume",
        entityId: "resume",
    });
    contentUpdated("resume", [...REVALIDATE_TAGS.resume]);
    if (removed.storageKey) {
        try {
            await getStorage().delete(removed.storageKey);
        }
        catch (error) {
            logger.warn({ err: error, key: removed.storageKey }, "Failed to delete the legacy resume file");
        }
    }
};
export const getDownload = async () => {
    const [resume, document] = await Promise.all([
        getResume(),
        getResumeDocument(),
    ]);
    if (!resume || !document)
        throw notFound("No resume is available.");
    // Bytes come straight from PostgreSQL now; nothing is read from disk.
    return { resume, stream: Readable.from(document.data) };
};
export const countDownload = async () => {
    await incrementResumeDownloadCount();
};
// Local-only convenience for tests that need a fresh read stream type.
export const isReadable = (value) => typeof value === "object" && value !== null && "pipe" in value;
//# sourceMappingURL=resume.service.js.map