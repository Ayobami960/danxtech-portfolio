import "dotenv/config";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { fileTypeFromBuffer } from "file-type";
import { env } from "../src/config/env.js";
import { closeDatabase, db } from "../src/db/client.js";
import {
  chatMessages,
  projectImages,
  projects,
} from "../src/database/schema.js";
import { getImageKitStorage, getStorage } from "../src/storage/index.js";

const LEGACY_IMAGE_LIMIT_BYTES = 5 * 1024 * 1024;

/**
 * One-off migration for images that were written to the local disk driver
 * before production was pointed at ImageKit.
 *
 *   npm run storage:migrate-local                     # dry run (default)
 *   npm run storage:migrate-local -- --apply          # upload + update rows
 *   npm run storage:migrate-local -- --apply --delete-local
 *
 * Rules:
 *   - dry run by default; nothing is uploaded or written without --apply;
 *   - a file is only uploaded when it exists on disk and is a real image;
 *   - the database row is updated immediately after its upload, so a later
 *     failure never leaves a row pointing at a file that was not stored;
 *   - rows whose file is gone from disk are reported, never guessed at;
 *   - seeded images (`external/` keys) and rows that already have a fileId are
 *     left untouched.
 */

type Args = {
  apply: boolean;
  deleteLocal: boolean;
};

type Failure = {
  table: "projects" | "project_images" | "chat_messages";
  id: string;
  detail: string;
  localPath?: string;
  key?: string;
};

type Stats = {
  scanned: number;
  local: number;
  migrated: number;
  skipped: number;
  failed: number;
};

const EXTERNAL_PREFIX = "external/";

const emptyStats = (): Stats => ({
  scanned: 0,
  local: 0,
  migrated: 0,
  skipped: 0,
  failed: 0,
});

const parseArgs = (argv: readonly string[]): Args => {
  let apply = false;
  let deleteLocal = false;

  for (const arg of argv) {
    if (arg === "--apply") apply = true;
    else if (arg === "--delete-local") deleteLocal = true;
    else if (arg === "--help" || arg === "-h") throw new Error("__help__");
    else throw new Error(`Unknown argument: ${arg}`);
  }

  return { apply, deleteLocal };
};

const usage = [
  "Usage: npm run storage:migrate-local -- [--apply] [--delete-local]",
  "",
  "  --apply         upload local files to ImageKit and update the database",
  "  --delete-local  delete each local file after it is migrated",
  "",
  "Without --apply this is a read-only dry run.",
].join("\n");

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** The key of an image that the local driver wrote, or null for anything else. */
const localMediaKey = (
  url: string | null,
  key: string | null,
): string | null => {
  if (key !== null && key.startsWith(EXTERNAL_PREFIX)) return null;
  if (url !== null) {
    const match = /\/media\/([^?#]+)/.exec(url);
    if (match?.[1]) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    }
    // Any other absolute URL is already hosted elsewhere (ImageKit or the
    // Client app), so there is nothing to migrate.
    if (/^https?:\/\//i.test(url)) return null;
  }
  return key;
};

const isAlreadyHosted = (url: string | null): boolean =>
  url !== null && /^https?:\/\//i.test(url) && !url.includes("/media/");

const diskPath = (key: string): string => {
  const root = path.resolve(env.storage.localDir);
  const resolved = path.resolve(root, key);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`Refusing to read outside the storage directory: ${key}`);
  }
  return resolved;
};

const readLocalImage = async (
  key: string,
): Promise<{ buffer: Buffer; mimeType: string; filePath: string }> => {
  const filePath = diskPath(key);
  let buffer: Buffer;
  try {
    buffer = await readFile(filePath);
  } catch {
    throw new Error(`File not found at ${filePath}`);
  }

  // The ceiling in force when these files were written; the live upload limit
  // only governs new uploads and must not skip legacy files here.
  if (buffer.length > LEGACY_IMAGE_LIMIT_BYTES) {
    throw new Error(
      `File is ${buffer.length} bytes, above the ${LEGACY_IMAGE_LIMIT_BYTES}-byte legacy limit`,
    );
  }

  const detected = await fileTypeFromBuffer(buffer);
  if (!detected || !detected.mime.startsWith("image/")) {
    throw new Error("File is not a recognised image");
  }

  return { buffer, mimeType: detected.mime, filePath };
};

const upload = async (
  key: string,
): Promise<{ url: string; fileId: string | null; key: string }> => {
  const { buffer, mimeType } = await readLocalImage(key);
  // Same key, same folder: the stored path stays stable across the migration.
  const stored = await getStorage().put(key, buffer, mimeType);
  return { url: stored.url, fileId: stored.fileId, key: stored.key };
};

const report = (
  args: Args,
  stats: Partial<
    Record<"projects" | "project_images" | "chat_messages", Stats>
  >,
  failures: Failure[],
  backfilled: number,
): void => {
  for (const [table, tableStats] of Object.entries(stats)) {
    if (!tableStats) continue;
    console.log(
      `  ${table}: ${tableStats.scanned} scanned, ${tableStats.local} local, ` +
        `${tableStats.migrated} migrated, ${tableStats.failed} failed`,
    );
  }

  if (backfilled > 0) {
    console.log(`  fileIds backfilled for already-hosted rows: ${backfilled}`);
  }

  const local = Object.values(stats).reduce(
    (sum, tableStats) => sum + (tableStats?.local ?? 0),
    0,
  );
  const migrated = Object.values(stats).reduce(
    (sum, tableStats) => sum + (tableStats?.migrated ?? 0),
    0,
  );

  if (local === 0 && failures.length === 0) {
    console.log(
      "\nNothing to migrate: no image still points at the local disk.",
    );
    return;
  }

  if (failures.length > 0) {
    console.log("\nRecords that could not be migrated:");
    for (const failure of failures) {
      console.log(`  ${failure.table} ${failure.id} — ${failure.detail}`);
      if (failure.key) console.log(`    key        : ${failure.key}`);
      if (failure.localPath)
        console.log(`    expected at: ${failure.localPath}`);
    }

    console.log(
      "\nThose images are not on ImageKit. Re-upload them through the admin UI " +
        "(or the original source) so their rows are written together with the upload.",
    );
    return;
  }

  console.log(
    args.apply
      ? `\nMigrated ${migrated} image(s) to ImageKit.`
      : `\n${migrated} image(s) are ready — re-run with --apply to upload them.`,
  );
};

const migrateProjects = async (
  args: Args,
  failures: Failure[],
): Promise<{ stats: Stats; backfilled: number }> => {
  const stats = emptyStats();
  let backfilled = 0;
  const rows = await db
    .select({
      id: projects.id,
      slug: projects.slug,
      coverImage: projects.coverImage,
      coverStorageKey: projects.coverStorageKey,
      coverFileId: projects.coverFileId,
    })
    .from(projects);

  for (const row of rows) {
    stats.scanned += 1;
    const key = localMediaKey(row.coverImage, row.coverStorageKey);

    if (key === null) {
      // Already on a CDN but written before fileIds were stored: remember it.
      if (
        args.apply &&
        row.coverFileId === null &&
        row.coverStorageKey !== null &&
        isAlreadyHosted(row.coverImage)
      ) {
        const found = await getImageKitStorage()?.findFileId(
          row.coverStorageKey,
        );
        if (found) {
          await db
            .update(projects)
            .set({ coverFileId: found })
            .where(eq(projects.id, row.id));
          backfilled += 1;
        }
      }
      stats.skipped += 1;
      continue;
    }

    stats.local += 1;
    console.log(`  project ${row.id} (${row.slug}) key=${key}`);

    if (!args.apply) {
      try {
        await readLocalImage(key);
        stats.migrated += 1;
      } catch (error) {
        stats.failed += 1;
        failures.push({
          table: "projects",
          id: `${row.id} (${row.slug})`,
          detail: describe(error),
          key,
          localPath: path.resolve(env.storage.localDir, key),
        });
      }
      continue;
    }

    try {
      const stored = await upload(key);
      await db
        .update(projects)
        .set({
          coverImage: stored.url,
          coverStorageKey: stored.key,
          coverFileId: stored.fileId,
          updatedAt: new Date(),
        })
        .where(eq(projects.id, row.id));
      stats.migrated += 1;

      if (args.deleteLocal) {
        await unlink(path.resolve(env.storage.localDir, key)).catch(
          () => undefined,
        );
      }
    } catch (error) {
      stats.failed += 1;
      failures.push({
        table: "projects",
        id: `${row.id} (${row.slug})`,
        detail: describe(error),
        key,
        localPath: path.resolve(env.storage.localDir, key),
      });
    }
  }

  return { stats, backfilled };
};

const migrateProjectImages = async (
  args: Args,
  failures: Failure[],
): Promise<{ stats: Stats; backfilled: number }> => {
  const stats = emptyStats();
  let backfilled = 0;
  const rows = await db
    .select({
      id: projectImages.id,
      projectId: projectImages.projectId,
      url: projectImages.url,
      storageKey: projectImages.storageKey,
      fileId: projectImages.fileId,
    })
    .from(projectImages);

  for (const row of rows) {
    stats.scanned += 1;
    const key = localMediaKey(row.url, row.storageKey);

    if (key === null) {
      if (args.apply && row.fileId === null && isAlreadyHosted(row.url)) {
        const found = await getImageKitStorage()?.findFileId(row.storageKey);
        if (found) {
          await db
            .update(projectImages)
            .set({ fileId: found })
            .where(eq(projectImages.id, row.id));
          backfilled += 1;
        }
      }
      stats.skipped += 1;
      continue;
    }

    stats.local += 1;
    console.log(
      `  gallery image ${row.id} (project ${row.projectId}) key=${key}`,
    );

    if (!args.apply) {
      try {
        await readLocalImage(key);
        stats.migrated += 1;
      } catch (error) {
        stats.failed += 1;
        failures.push({
          table: "project_images",
          id: `${row.id} (project ${row.projectId})`,
          detail: describe(error),
          key,
          localPath: path.resolve(env.storage.localDir, key),
        });
      }
      continue;
    }

    try {
      const stored = await upload(key);
      await db
        .update(projectImages)
        .set({
          url: stored.url,
          storageKey: stored.key,
          fileId: stored.fileId,
        })
        .where(eq(projectImages.id, row.id));
      stats.migrated += 1;

      if (args.deleteLocal) {
        await unlink(path.resolve(env.storage.localDir, key)).catch(
          () => undefined,
        );
      }
    } catch (error) {
      stats.failed += 1;
      failures.push({
        table: "project_images",
        id: `${row.id} (project ${row.projectId})`,
        detail: describe(error),
        key,
        localPath: path.resolve(env.storage.localDir, key),
      });
    }
  }

  return { stats, backfilled };
};

/**
 * Chat attachments store only their key, so a local one is identified by the
 * file still being on disk. Re-uploading under the same key is enough: the URL
 * is derived from the key when the message is read.
 */
const migrateChatImages = async (
  args: Args,
  failures: Failure[],
): Promise<Stats> => {
  const stats = emptyStats();
  const rows = await db
    .select({ id: chatMessages.id, key: chatMessages.imageKey })
    .from(chatMessages);

  for (const row of rows) {
    if (row.key === null) continue;
    stats.scanned += 1;

    let present = true;
    try {
      await readLocalImage(row.key);
    } catch (error) {
      const message = describe(error);
      // Not on disk: it was either uploaded to ImageKit already or lost with
      // the ephemeral filesystem. Only report the ones we cannot explain.
      if (!message.startsWith("File not found")) {
        stats.failed += 1;
        failures.push({
          table: "chat_messages",
          id: row.id,
          detail: message,
          key: row.key,
        });
      }
      present = false;
    }

    if (!present) continue;
    stats.local += 1;
    console.log(`  chat message ${row.id} key=${row.key}`);

    if (!args.apply) {
      stats.migrated += 1;
      continue;
    }

    try {
      await upload(row.key);
      stats.migrated += 1;
      if (args.deleteLocal) {
        await unlink(path.resolve(env.storage.localDir, row.key)).catch(
          () => undefined,
        );
      }
    } catch (error) {
      stats.failed += 1;
      failures.push({
        table: "chat_messages",
        id: row.id,
        detail: describe(error),
        key: row.key,
      });
    }
  }

  return stats;
};

const main = async (): Promise<void> => {
  let args: Args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.log(usage);
    if (describe(error) !== "__help__") {
      console.error(`\n${describe(error)}`);
      process.exitCode = 1;
    }
    return;
  }

  if (env.storage.driver !== "imagekit") {
    console.error(
      `This script needs STORAGE_DRIVER=imagekit (current: ${env.storage.driver}).\n` +
        "Set it in backend/.env first; no live secret is printed here.",
    );
    process.exitCode = 1;
    return;
  }

  console.log(`ImageKit migration — ${args.apply ? "APPLY" : "DRY RUN"}`);
  console.log(`  storage driver : ${env.storage.driver}`);
  console.log(`  local dir      : ${path.resolve(env.storage.localDir)}`);

  const failures: Failure[] = [];
  const projectResult = await migrateProjects(args, failures);
  const galleryResult = await migrateProjectImages(args, failures);
  const chatStats = await migrateChatImages(args, failures);

  report(
    args,
    {
      projects: projectResult.stats,
      project_images: galleryResult.stats,
      chat_messages: chatStats,
    },
    failures,
    projectResult.backfilled + galleryResult.backfilled,
  );

  if (args.apply && failures.length > 0) process.exitCode = 1;
};

main()
  .then(async () => {
    await closeDatabase();
  })
  .catch(async (error: unknown) => {
    console.error(`storage:migrate-local failed: ${describe(error)}`);
    process.exitCode = 1;
    await closeDatabase().catch(() => undefined);
  });
