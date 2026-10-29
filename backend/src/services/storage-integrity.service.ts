// services/storage-integrity.service.ts
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import {
  listStoredCoverKeys,
  listStoredGalleryKeys,
} from "../repositories/project.repository.js";
import { getResume } from "../repositories/resume.repository.js";
import { getImageKitStorage, getStorage } from "../storage/index.js";

/** Maximum number of ImageKit requests kept in flight at once. */
const CONCURRENCY = 5;
const REQUEST_TIMEOUT_MS = 8_000;

/** Seed assets are hosted by the public site, never in our storage. */
const EXTERNAL_PREFIX = "external/";

export type MediaTable = "projects" | "project_images" | "resumes";

export type MediaKeyRef = {
  table: MediaTable;
  rowId: string;
  key: string;
};

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

const normalizePath = (value: string): string => value.replace(/^\/+/, "");

const folderOf = (key: string): string => {
  const index = key.lastIndexOf("/");
  return index === -1 ? "/" : `/${key.slice(0, index)}`;
};

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

/** Every storage key the database expects us to serve, across all tables. */
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
      key: row.key,
    })),
    ...gallery.map((row) => ({
      table: "project_images" as const,
      rowId: row.id,
      key: row.key,
    })),
  ];

  // Resumes now live in PostgreSQL; only a legacy row can still have a key.
  if (resume?.storageKey) {
    refs.push({ table: "resumes", rowId: resume.id, key: resume.storageKey });
  }

  return refs.filter((ref) => !ref.key.startsWith(EXTERNAL_PREFIX));
};

const headProbe = async (key: string): Promise<Probe> => {
  try {
    const response = await fetch(getStorage().publicUrl(key), {
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
 * storage. ImageKit is queried per folder (one listing serves every key in that
 * folder) and the CDN HEAD check answers for folders whose listing failed.
 * A network failure is reported as "unknown", never as "missing".
 */
export const runStorageIntegrityCheck =
  async (): Promise<StorageIntegrityReport> => {
    const refs = await collectMediaRefs();
    const verdicts: Probe[] = refs.map(() => ({ status: "ok" }));
    const imagekit = getImageKitStorage();

    if (imagekit) {
      const folders = [...new Set(refs.map((ref) => folderOf(ref.key)))];
      const listings = new Map<string, Set<string> | null>();

      await runWithConcurrency(folders, CONCURRENCY, async (folder) => {
        try {
          const paths = await imagekit.listFolderPaths(folder);
          listings.set(folder, new Set(paths.map(normalizePath)));
        } catch (error) {
          listings.set(folder, null);
          logger.warn(
            { err: error, folder },
            "ImageKit folder listing failed; falling back to HEAD checks",
          );
        }
      });

      const pending: IndexedKey[] = [];
      refs.forEach((ref, index) => {
        const listing = listings.get(folderOf(ref.key));
        if (listing && listing.has(normalizePath(ref.key))) {
          verdicts[index] = { status: "ok" };
          return;
        }
        pending.push({ index, key: ref.key });
      });

      await runWithConcurrency(pending, CONCURRENCY, async (item) => {
        verdicts[item.index] = await headProbe(item.key);
      });
    } else {
      const pending: IndexedKey[] = refs.map((ref, index) => ({
        index,
        key: ref.key,
      }));
      await runWithConcurrency(pending, CONCURRENCY, async (item) => {
        verdicts[item.index] = await headProbe(item.key);
      });
    }

    const missing: StorageIntegrityIssue[] = [];
    const unknown: StorageIntegrityIssue[] = [];

    refs.forEach((ref, index) => {
      const verdict = verdicts[index];
      if (!verdict || verdict.status === "ok") return;
      if (verdict.status === "missing") {
        missing.push({ table: ref.table, rowId: ref.rowId, key: ref.key });
        return;
      }
      unknown.push({
        table: ref.table,
        rowId: ref.rowId,
        key: ref.key,
        reason: verdict.reason,
      });
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
