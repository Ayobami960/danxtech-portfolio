// storage/imagekit.storage.ts
import { Readable } from "node:stream";
import { logger } from "../config/logger.js";
import { AppError, ERROR_CODES } from "../lib/errors.js";
const UPLOAD_URL = "https://upload.imagekit.io/api/v1/files/upload";
const API_URL = "https://api.imagekit.io/v1/files";
/** One attempt plus two retries; retries cover 5xx responses and network errors only. */
const UPLOAD_MAX_ATTEMPTS = 3;
const UPLOAD_RETRY_BASE_DELAY_MS = 300;
const UPLOAD_TIMEOUT_MS = 60_000;
const LOOKUP_TIMEOUT_MS = 10_000;
const LIST_PAGE_SIZE = 100;
const LIST_MAX_PAGES = 50;
const LIST_RATE_LIMIT_DELAY_MS = 1_000;
/**
 * Client-facing messages stay generic: ImageKit's own text and our config
 * details are logged server-side and never returned to the browser.
 */
const UNAVAILABLE_MESSAGE = "Image storage is unavailable right now. Please try again.";
const REJECTED_MESSAGE = "The image was rejected by image storage.";
const TOO_LARGE_MESSAGE = "The image is too large for the image storage plan.";
const UNCONFIRMED_MESSAGE = "The image could not be stored. Please try again.";
const splitKey = (key) => {
    const clean = key.replace(/^\/+/, "");
    const index = clean.lastIndexOf("/");
    return index === -1
        ? { folder: "/", fileName: clean }
        : { folder: `/${clean.slice(0, index)}`, fileName: clean.slice(index + 1) };
};
const isRecord = (value) => typeof value === "object" && value !== null;
const originOf = (value) => {
    try {
        return new URL(value).origin;
    }
    catch {
        return null;
    }
};
const safeDecode = (value) => {
    try {
        return decodeURIComponent(value);
    }
    catch {
        return value;
    }
};
const sleep = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const enoent = (key) => {
    const error = new Error(`ImageKit file not found: ${key}`);
    error.code = "ENOENT";
    return error;
};
/** Map an ImageKit status onto the API contract: our input is never the culprit for 5xx or auth failures. */
const uploadFailure = (status) => {
    if (status === 413) {
        return new AppError(413, ERROR_CODES.PAYLOAD_TOO_LARGE, TOO_LARGE_MESSAGE);
    }
    if (status === 400 || status === 409 || status === 422) {
        return new AppError(400, ERROR_CODES.VALIDATION_ERROR, REJECTED_MESSAGE);
    }
    return new AppError(502, ERROR_CODES.SERVICE_UNAVAILABLE, UNAVAILABLE_MESSAGE);
};
/** Read ImageKit's error text for the log without leaking the key, auth header or file bytes. */
const readUpstreamError = async (response) => {
    const requestId = response.headers.get("x-ik-requestid");
    let raw;
    try {
        raw = await response.text();
    }
    catch {
        raw = "";
    }
    let message = "";
    try {
        const parsed = JSON.parse(raw);
        if (isRecord(parsed) && typeof parsed.message === "string") {
            message = parsed.message;
        }
    }
    catch {
        // ImageKit answers some failures with a plain-text body.
        message = raw.trim();
    }
    return {
        message: (message || response.statusText || "no message").slice(0, 500),
        requestId,
    };
};
export class ImageKitStorage {
    name = "imagekit";
    auth;
    endpoint;
    constructor(config) {
        // Basic auth: private key as username, empty password.
        this.auth = `Basic ${Buffer.from(`${config.privateKey}:`).toString("base64")}`;
        this.endpoint = config.urlEndpoint.replace(/\/+$/, "");
    }
    async put(key, body, contentType) {
        const { folder, fileName } = splitKey(key);
        const form = new FormData();
        const bytes = new Uint8Array(body.length);
        body.copy(bytes);
        form.set("file", new Blob([bytes], { type: contentType }), fileName);
        form.set("fileName", fileName);
        form.set("folder", folder);
        // Keep the exact key so it can be addressed later.
        form.set("useUniqueFileName", "false");
        form.set("overwriteFile", "true");
        const context = {
            key,
            folder,
            fileName,
            sizeBytes: body.length,
            contentType,
        };
        const response = await this.sendUpload(form, context);
        if (!response.ok) {
            const upstream = await readUpstreamError(response);
            logger.error({
                provider: this.name,
                upstreamStatus: response.status,
                upstreamMessage: upstream.message,
                upstreamRequestId: upstream.requestId,
                ...context,
            }, "ImageKit rejected an upload");
            throw uploadFailure(response.status);
        }
        // Confirm ImageKit stored exactly the key we will address later, and that
        // the delivery URL it reports belongs to the configured endpoint. A wrong
        // IMAGEKIT_END_POINT used to be written to the database as a dead URL.
        const payload = await response.json().catch(() => null);
        const uploaded = isRecord(payload) ? payload : {};
        const storedPath = typeof uploaded.filePath === "string" ? safeDecode(uploaded.filePath) : "";
        const deliveredUrl = typeof uploaded.url === "string" ? uploaded.url : "";
        const expectedPath = `/${key.replace(/^\/+/, "")}`;
        const configuredOrigin = originOf(this.endpoint);
        if (storedPath !== expectedPath || deliveredUrl === "") {
            logger.error({ provider: this.name, key, expectedPath, storedPath, deliveredUrl }, "ImageKit did not confirm the uploaded path");
            throw new AppError(502, ERROR_CODES.SERVICE_UNAVAILABLE, UNCONFIRMED_MESSAGE);
        }
        const deliveredOrigin = originOf(deliveredUrl);
        if (!configuredOrigin || deliveredOrigin !== configuredOrigin) {
            logger.error({ provider: this.name, key, configuredOrigin, deliveredOrigin }, "IMAGEKIT_END_POINT does not match the delivery URL ImageKit returned");
            throw new AppError(502, ERROR_CODES.SERVICE_UNAVAILABLE, UNCONFIRMED_MESSAGE);
        }
    }
    async delete(key) {
        const fileId = await this.findFileId(key);
        if (!fileId)
            return; // already gone: deletion is idempotent
        const response = await fetch(`${API_URL}/${fileId}`, {
            method: "DELETE",
            headers: { Authorization: this.auth },
        });
        if (!response.ok && response.status !== 404) {
            throw new AppError(502, ERROR_CODES.INTERNAL_ERROR, `ImageKit delete failed (${response.status}).`);
        }
    }
    async getStream(key) {
        const url = `${this.endpoint}/${key.replace(/^\/+/, "")}`;
        const response = await fetch(url);
        if (response.status === 404)
            throw enoent(key);
        if (!response.ok || !response.body) {
            throw new Error(`ImageKit download failed (${response.status}).`);
        }
        return Readable.fromWeb(response.body);
    }
    publicUrl(key) {
        return `${this.endpoint}/${key.replace(/^\/+/, "")}`;
    }
    /**
     * Absolute ImageKit paths of the files directly inside `folder`. One request
     * per folder (paged) is far cheaper than a lookup per key. Throws on any
     * upstream failure so callers can report "unknown" instead of "missing".
     */
    async listFolderPaths(folder) {
        const paths = [];
        let skip = 0;
        for (let page = 0; page < LIST_MAX_PAGES; page += 1) {
            const params = new URLSearchParams({
                path: folder,
                limit: String(LIST_PAGE_SIZE),
                skip: String(skip),
            });
            let response = await fetch(`${API_URL}?${params}`, {
                headers: { Authorization: this.auth },
                signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
            });
            if (response.status === 429) {
                await sleep(LIST_RATE_LIMIT_DELAY_MS);
                response = await fetch(`${API_URL}?${params}`, {
                    headers: { Authorization: this.auth },
                    signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS),
                });
            }
            if (!response.ok) {
                throw new Error(`ImageKit listing failed (${response.status}) for ${folder}.`);
            }
            const payload = await response.json();
            if (!Array.isArray(payload)) {
                throw new Error("ImageKit listing returned an unexpected payload.");
            }
            for (const entry of payload) {
                if (!isRecord(entry))
                    continue;
                if (entry.type === "file" && typeof entry.filePath === "string") {
                    paths.push(safeDecode(entry.filePath));
                }
            }
            if (payload.length < LIST_PAGE_SIZE)
                break;
            skip += LIST_PAGE_SIZE;
        }
        return paths;
    }
    /** Upload with bounded retries; 5xx and network failures are retried, 4xx never is. */
    async sendUpload(form, context) {
        let lastError;
        for (let attempt = 1; attempt <= UPLOAD_MAX_ATTEMPTS; attempt += 1) {
            try {
                const response = await fetch(UPLOAD_URL, {
                    method: "POST",
                    headers: { Authorization: this.auth },
                    body: form,
                    signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
                });
                if (response.status < 500 || attempt === UPLOAD_MAX_ATTEMPTS) {
                    return response;
                }
                logger.warn({
                    provider: this.name,
                    attempt,
                    upstreamStatus: response.status,
                    upstreamRequestId: response.headers.get("x-ik-requestid"),
                    ...context,
                }, "ImageKit upload returned a server error; retrying");
                await response.text().catch(() => "");
            }
            catch (error) {
                lastError = error;
                if (attempt === UPLOAD_MAX_ATTEMPTS)
                    break;
                logger.warn({ err: error, provider: this.name, attempt, ...context }, "ImageKit upload request failed; retrying");
            }
            await sleep(UPLOAD_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
        }
        logger.error({ err: lastError, provider: this.name, ...context }, "ImageKit upload could not be completed");
        throw new AppError(502, ERROR_CODES.SERVICE_UNAVAILABLE, UNAVAILABLE_MESSAGE);
    }
    async findFileId(key) {
        const { folder, fileName } = splitKey(key);
        const params = new URLSearchParams({
            path: folder,
            searchQuery: `name = "${fileName.replace(/"/g, '\\"')}"`,
            limit: "1",
        });
        const response = await fetch(`${API_URL}?${params}`, {
            headers: { Authorization: this.auth },
        });
        if (!response.ok) {
            throw new Error(`ImageKit lookup failed (${response.status}).`);
        }
        const files = (await response.json());
        return files[0]?.fileId ?? null;
    }
}
//# sourceMappingURL=imagekit.storage.js.map