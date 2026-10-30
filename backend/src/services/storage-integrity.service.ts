// services/storage-integrity.service.ts
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import {
  listStoredCoverKeys,
  listStoredGalleryKeys,
} from "../repositories/project.repository.js";
import { getResume } from "../repositories/resume.repository.js";
import { getStorage } from "../storage/index.js";

/** Maximum number of concurrent Cloudinary HEAD checks. */
const CONCURRENCY = 5;
const REQUEST_TIMEOUT_MS = 8_000;

/** Seed assets are hosted by the public site, never in our storage. */
const EXTERNAL_PREFIX = "external/";
/** Every Cloudinary public_id this app creates starts here. */
const PORTFOLIO_PREFIX = "portfolio/";

export type MediaTable = "projects" | "project_images" | "resumes";
export type MediaKeyRef = {
  table: MediaTable;
  rowId: string;
  /** Cloudinary public_id used to build the delivery URL. */
  key: string;
  /** PDFs live on Cloudinary's `raw` endpoint, images on `image`. */
  resourceType: "image" | "raw";
};

/**
 * Only ids this app generated are checked. A Cloudinary public_id always lives
 * under `portfolio/`; anything else (ImageKit file ids on legacy rows, seed
 * assets served by the public site) is skipped instead of being reported as a
 * missing object.
 */
const isCloudinaryPublicId = (value: string | null): value is string =>
  value !== null && value.startsWith(PORTFOLIO_PREFIX) && !value.includes("..");
export type StorageIntegrityIssue = MediaKeyRef & { reason?: string };
export type StorageIntegrityReport = {
  driver: string;
  checked: number;
  ok: number;
  missing: StorageIntegrityIssue[];
  unknown: StorageIntegrityIssue[];
};

type Probe =
  | { status: "ok" }
  | { status: "missing" }
  | { status: "unknown"; reason: string };

type IndexedKey = { index: number; key: string };

const runWithConcurrency = async <T>(
  items: readonly T[],
  limit: number,
  worker: (item: T) => Promise<void>,
): Promise<void> => {
  let cursor = 0;
  const runners = Array.from(
    { length: Math.max(1, Math.min(limit, items.length)) },
    async () => {
      while (cursor < items.length) {
        const item = items[cursor];
        cursor += 1;
        if (item === undefined) continue;
        await worker(item);
      }
    },
  );
  await Promise.all(runners);
};

/** Every Cloudinary object the database expects us to serve, across all tables. */
export const collectMediaRefs = async (): Promise<MediaKeyRef[]> => {
  const [covers, gallery, resume] = await Promise.all([
    listStoredCoverKeys(),
    listStoredGalleryKeys(),
    getResume(),
  ]);

  const refs: MediaKeyRef[] = [
    ...covers.map((row) => ({
      table: "projects" as const,
      rowId: row.id,
      publicId: row.publicId,
      resourceType: "image" as const,
    })),
    ...gallery.map((row) => ({
      table: "project_images" as const,
      rowId: row.id,
      publicId: row.publicId,
      resourceType: "image" as const,
    })),
    ...(resume
      ? [
          {
            table: "resumes" as const,
            rowId: resume.id,
            publicId: resume.publicId,
            resourceType: "raw" as const,
          },
        ]
      : []),
  ]
    .filter((row) => isCloudinaryPublicId(row.publicId))
    .map((row) => ({
      table: row.table,
      rowId: row.rowId,
      key: row.publicId as string,
      resourceType: row.resourceType,
    }));

  return refs.filter((ref) => !ref.key.startsWith(EXTERNAL_PREFIX));
};

const headProbe = async (
  key: string,
  resourceType: "image" | "raw",
): Promise<Probe> => {
  try {
    const response = await fetch(getStorage().publicUrl(key, resourceType), {
      method: "HEAD",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (response.ok) return { status: "ok" };
    if (response.status === 404 || response.status === 410) {
      return { status: "missing" };
    }
    return { status: "unknown", reason: `HEAD returned ${response.status}` };
  } catch (error) {
    return {
      status: "unknown",
      reason: error instanceof Error ? error.message : "network error",
    };
  }
};

/**
 * Compare the keys stored in the database with the files actually present in
 * Cloudinary. Because Cloudinary has no cheap per-folder listing for
 * arbitrary public_ids, every key is verified with a HEAD request to its
 * public URL. A network failure is reported as "unknown", never as "missing".
 */
export const runStorageIntegrityCheck =
  async (): Promise<StorageIntegrityReport> => {
    const refs = await collectMediaRefs();
    const verdicts: Probe[] = refs.map(() => ({ status: "ok" }));

    const pending: IndexedKey[] = refs.map((ref, index) => ({
      index,
      key: ref.key,
    }));
    await runWithConcurrency(pending, CONCURRENCY, async (item) => {
      const resourceType = refs[item.index]?.resourceType ?? "image";
      verdicts[item.index] = await headProbe(item.key, resourceType);
    });

    const missing: StorageIntegrityIssue[] = [];
    const unknown: StorageIntegrityIssue[] = [];

    refs.forEach((ref, index) => {
      const verdict = verdicts[index];
      if (!verdict || verdict.status === "ok") return;
      if (verdict.status === "missing") {
        missing.push({ ...ref });
        return;
      }
      unknown.push({ ...ref, reason: verdict.reason });
    });

    const report: StorageIntegrityReport = {
      driver: getStorage().name,
      checked: refs.length,
      ok: refs.length - missing.length - unknown.length,
      missing,
      unknown,
    };

    logger.info(
      {
        driver: report.driver,
        checked: report.checked,
        ok: report.ok,
        missing: missing.length,
        errors: unknown.length,
      },
      "Storage integrity check finished",
    );

    for (const item of missing) {
      logger.warn(
        { table: item.table, rowId: item.rowId, key: item.key },
        "Stored media key is missing from image storage",
      );
    }
    for (const item of unknown) {
      logger.warn(
        {
          table: item.table,
          rowId: item.rowId,
          key: item.key,
          reason: item.reason,
        },
        "Stored media key could not be verified",
      );
    }

    return report;
  };

/**
 * Fire-and-forget check for `after the server starts listening`. It is never
 * awaited, so a slow or failing storage provider cannot delay or crash boot.
 */
export const scheduleStorageIntegrityCheck = (): void => {
  if (!env.storageIntegrityCheck) return;

  void runStorageIntegrityCheck().catch((error: unknown) => {
    logger.error({ err: error }, "Storage integrity check failed to run");
  });
};
