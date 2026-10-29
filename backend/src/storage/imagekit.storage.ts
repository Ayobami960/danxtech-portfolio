// storage/imagekit.storage.ts
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import ImageKit from "imagekit";
import { logger } from "../config/logger.js";
import { AppError, ERROR_CODES } from "../lib/errors.js";
import type { StorageDriver, StoredFile } from "./types.js";

/** One attempt plus two retries; retries cover 5xx, 429 and network errors only. */
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
const UNAVAILABLE_MESSAGE =
  "Image storage is unavailable right now. Please try again.";
const REJECTED_MESSAGE = "The image was rejected by image storage.";
const TOO_LARGE_MESSAGE = "The image is too large for the image storage plan.";
const UNCONFIRMED_MESSAGE = "The image could not be stored. Please try again.";

export type ImageKitConfig = {
  /** Required by the SDK constructor; never used for server-side uploads. */
  publicKey: string;
  privateKey: string;
  urlEndpoint: string;
};

/** The subset of ImageKit's upload response this driver relies on. */
type UploadResult = { fileId: string; url: string; filePath: string };
/** The subset of a listed file this driver relies on. */
type ListedFile = { fileId?: string; filePath?: string; type?: string };

const splitKey = (key: string): { folder: string; fileName: string } => {
  const clean = key.replace(/^\/+/, "");
  const index = clean.lastIndexOf("/");
  return index === -1
    ? { folder: "/", fileName: clean }
    : { folder: `/${clean.slice(0, index)}`, fileName: clean.slice(index + 1) };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const originOf = (value: string): string | null => {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const safeDecode = (value: string): string => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const sleep = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

/** Bounds a provider call so one hung request cannot hold a serverless invocation. */
const withTimeout = async <T>(
  promise: Promise<T>,
  milliseconds: number,
  label: string,
): Promise<T> => {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} timed out after ${milliseconds}ms.`)),
          milliseconds,
        );
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

const enoent = (key: string): NodeJS.ErrnoException => {
  const error = new Error(
    `ImageKit file not found: ${key}`,
  ) as NodeJS.ErrnoException;
  error.code = "ENOENT";
  return error;
};

/**
 * The SDK rejects with the parsed response body (a plain object carrying
 * `$ResponseMetadata.statusCode`) for HTTP failures and with an Error when the
 * request never reached ImageKit.
 */
const statusOf = (error: unknown): number | null => {
  const metadata = isRecord(error) ? error.$ResponseMetadata : undefined;
  if (isRecord(metadata) && typeof metadata.statusCode === "number") {
    return metadata.statusCode;
  }
  const status = isRecord(error) ? error.statusCode : undefined;
  return typeof status === "number" ? status : null;
};

/** ImageKit's support reference for one failed request, when it was returned. */
const requestIdOf = (error: unknown): string | undefined => {
  const metadata = isRecord(error) ? error.$ResponseMetadata : undefined;
  if (!isRecord(metadata) || !isRecord(metadata.headers)) return undefined;
  const value =
    metadata.headers["x-ik-requestid"] ?? metadata.headers["X-IK-Requestid"];
  return typeof value === "string" ? value : undefined;
};

const messageOf = (error: unknown): string => {
  if (error instanceof Error) return error.message;
  const message = isRecord(error) ? error.message : undefined;
  return typeof message === "string" ? message : "no message";
};

/** Map an ImageKit status onto the API contract: our input is never the culprit for 5xx or auth failures. */
const uploadFailure = (status: number): AppError => {
  if (status === 413) {
    return new AppError(413, ERROR_CODES.PAYLOAD_TOO_LARGE, TOO_LARGE_MESSAGE);
  }
  if (status === 400 || status === 409 || status === 422) {
    return new AppError(400, ERROR_CODES.VALIDATION_ERROR, REJECTED_MESSAGE);
  }
  return new AppError(502, ERROR_CODES.SERVICE_UNAVAILABLE, UNAVAILABLE_MESSAGE);
};

type UploadContext = {
  key: string;
  folder: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
};

export class ImageKitStorage implements StorageDriver {
  readonly name = "imagekit" as const;
  private readonly client: ImageKit;
  private readonly endpoint: string;

  constructor(config: ImageKitConfig) {
    this.client = new ImageKit({
      publicKey: config.publicKey,
      privateKey: config.privateKey,
      urlEndpoint: config.urlEndpoint,
    });
    this.endpoint = config.urlEndpoint.replace(/\/+$/, "");
  }

  async put(key: string, body: Buffer, contentType: string): Promise<StoredFile> {
    const { folder, fileName } = splitKey(key);

    const context: UploadContext = {
      key,
      folder,
      fileName,
      sizeBytes: body.length,
      contentType,
    };

    const uploaded = await this.sendUpload(
      {
        file: body,
        fileName,
        folder,
        // Keep the exact key so it can be addressed (and replaced) later.
        useUniqueFileName: false,
        overwriteFile: true,
      },
      context,
    );

    // Confirm ImageKit stored exactly the key we will address later, and that
    // the delivery URL it reports belongs to the configured endpoint. A wrong
    // IMAGEKIT_URL_ENDPOINT used to be written to the database as a dead URL.
    const storedPath =
      typeof uploaded.filePath === "string" ? safeDecode(uploaded.filePath) : "";
    const deliveredUrl = typeof uploaded.url === "string" ? uploaded.url : "";
    const expectedPath = `/${key.replace(/^\/+/, "")}`;
    const configuredOrigin = originOf(this.endpoint);

    if (storedPath !== expectedPath || deliveredUrl === "") {
      logger.error(
        { provider: this.name, key, expectedPath, storedPath, deliveredUrl },
        "ImageKit did not confirm the uploaded path",
      );
      throw new AppError(
        502,
        ERROR_CODES.SERVICE_UNAVAILABLE,
        UNCONFIRMED_MESSAGE,
      );
    }

    const deliveredOrigin = originOf(deliveredUrl);
    if (!configuredOrigin || deliveredOrigin !== configuredOrigin) {
      logger.error(
        { provider: this.name, key, configuredOrigin, deliveredOrigin },
        "IMAGEKIT_URL_ENDPOINT does not match the delivery URL ImageKit returned",
      );
      throw new AppError(
        502,
        ERROR_CODES.SERVICE_UNAVAILABLE,
        UNCONFIRMED_MESSAGE,
      );
    }

    return {
      key: expectedPath.replace(/^\/+/, ""),
      url: deliveredUrl,
      fileId: uploaded.fileId,
    };
  }

  async delete(key: string): Promise<void> {
    const fileId = await this.findFileId(key);
    if (!fileId) return; // already gone: deletion is idempotent
    await this.deleteById(fileId);
  }

  /** Delete by the stored fileId: one request, no path lookup. */
  async deleteById(fileId: string): Promise<void> {
    try {
      await withTimeout(
        this.client.deleteFile(fileId),
        LOOKUP_TIMEOUT_MS,
        "ImageKit delete",
      );
    } catch (error) {
      // Already deleted: deletion is idempotent.
      if (statusOf(error) === 404) return;
      throw error;
    }
  }

  async getStream(key: string): Promise<Readable> {
    const url = `${this.endpoint}/${key.replace(/^\/+/, "")}`;
    const response = await fetch(url);

    if (response.status === 404) throw enoent(key);
    if (!response.ok || !response.body) {
      throw new Error(`ImageKit download failed (${response.status}).`);
    }
    return Readable.fromWeb(response.body as unknown as WebReadableStream);
  }

  publicUrl(key: string): string {
    return `${this.endpoint}/${key.replace(/^\/+/, "")}`;
  }

  /**
   * The fileId ImageKit assigned to `key`, or null when the file does not exist.
   * Legacy rows written before fileIds were stored use this once.
   */
  async findFileId(key: string): Promise<string | null> {
    const { folder, fileName } = splitKey(key);
    const files = await this.listFiles({
      path: folder,
      searchQuery: `name = "${fileName.replace(/"/g, '\\"')}"`,
      limit: 1,
    });
    return files.find((file) => file.fileId)?.fileId ?? null;
  }

  /**
   * Absolute ImageKit paths of the files directly inside `folder`. One request
   * per folder (paged) is far cheaper than a lookup per key. Throws on any
   * upstream failure so callers can report "unknown" instead of "missing".
   */
  async listFolderPaths(folder: string): Promise<string[]> {
    const paths: string[] = [];
    let skip = 0;

    for (let page = 0; page < LIST_MAX_PAGES; page += 1) {
      const files = await this.listFiles({
        path: folder,
        limit: LIST_PAGE_SIZE,
        skip,
      });

      for (const file of files) {
        if (file.type === "file" && typeof file.filePath === "string") {
          paths.push(safeDecode(file.filePath));
        }
      }

      if (files.length < LIST_PAGE_SIZE) break;
      skip += LIST_PAGE_SIZE;
    }

    return paths;
  }

  /** Paged listing with one retry when ImageKit rate-limits us. */
  private async listFiles(options: {
    path: string;
    limit: number;
    skip?: number;
    searchQuery?: string;
  }): Promise<ListedFile[]> {
    const call = (): Promise<ListedFile[]> =>
      withTimeout(
        this.client.listFiles(options) as unknown as Promise<ListedFile[]>,
        LOOKUP_TIMEOUT_MS,
        "ImageKit listing",
      );

    let files: ListedFile[];
    try {
      files = await call();
    } catch (error) {
      if (statusOf(error) !== 429) throw error;
      await sleep(LIST_RATE_LIMIT_DELAY_MS);
      files = await call();
    }

    if (!Array.isArray(files)) {
      throw new Error("ImageKit listing returned an unexpected payload.");
    }
    return files;
  }

  /** Upload with bounded retries; 5xx, 429 and network failures are retried, 4xx never is. */
  private async sendUpload(
    options: {
      file: Buffer;
      fileName: string;
      folder: string;
      useUniqueFileName: boolean;
      overwriteFile: boolean;
    },
    context: UploadContext,
  ): Promise<UploadResult> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= UPLOAD_MAX_ATTEMPTS; attempt += 1) {
      try {
        const response = (await withTimeout(
          this.client.upload(options) as unknown as Promise<UploadResult>,
          UPLOAD_TIMEOUT_MS,
          "ImageKit upload",
        )) as UploadResult;

        if (typeof response?.fileId !== "string" || response.fileId === "") {
          logger.error(
            { provider: this.name, ...context },
            "ImageKit upload returned no fileId",
          );
          throw new AppError(
            502,
            ERROR_CODES.SERVICE_UNAVAILABLE,
            UNCONFIRMED_MESSAGE,
          );
        }
        return response;
      } catch (error) {
        lastError = error;
        // A validation error from our own response check is final.
        if (error instanceof AppError) break;

        const status = statusOf(error);
        const retryable = status === null || status === 429 || status >= 500;
        if (!retryable || attempt === UPLOAD_MAX_ATTEMPTS) break;

        logger.warn(
          {
            err: error,
            provider: this.name,
            attempt,
            upstreamStatus: status,
            upstreamMessage: messageOf(error),
            upstreamRequestId: requestIdOf(error),
            ...context,
          },
          "ImageKit upload failed; retrying",
        );
        await sleep(UPLOAD_RETRY_BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }

    if (lastError instanceof AppError) throw lastError;

    const status = statusOf(lastError);
    logger.error(
      {
        err: lastError,
        provider: this.name,
        upstreamStatus: status,
        upstreamMessage: messageOf(lastError),
        upstreamRequestId: requestIdOf(lastError),
        ...context,
      },
      "ImageKit rejected an upload",
    );
    throw status === null
      ? new AppError(502, ERROR_CODES.SERVICE_UNAVAILABLE, UNAVAILABLE_MESSAGE)
      : uploadFailure(status);
  }
}
