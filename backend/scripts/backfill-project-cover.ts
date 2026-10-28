import "dotenv/config";
import { eq } from "drizzle-orm";
import { env } from "../src/config/env.js";
import { closeDatabase, db } from "../src/db/client.js";
import { projects } from "../src/database/schema.js";
import { findProjectBySlug } from "../src/repositories/project.repository.js";
import { getImageKitStorage, publicMediaUrl } from "../src/storage/index.js";

/**
 * One-off repair for a project whose cover row disagrees with ImageKit.
 *
 *   tsx scripts/backfill-project-cover.ts                       # dry run
 *   tsx scripts/backfill-project-cover.ts --apply               # write the row
 *   tsx scripts/backfill-project-cover.ts --slug=<slug>
 *   tsx scripts/backfill-project-cover.ts --key=<imagekit path>
 *
 * Rules:
 *   - dry run by default; only --apply writes, and only the target row;
 *   - the write happens in a single transaction;
 *   - nothing is written unless the target file is confirmed in ImageKit, so a
 *     404 is never traded for another 404.
 */

const DEFAULT_SLUG = "real-estate-platform";
const REQUEST_TIMEOUT_MS = 8_000;

type Args = {
  apply: boolean;
  slug: string;
  key: string | undefined;
};

type Presence = "ok" | "missing" | "unknown";

const usage =
  "Usage: tsx scripts/backfill-project-cover.ts [--apply] [--slug=<slug>] [--key=<imagekit path>]";

const parseArgs = (argv: readonly string[]): Args => {
  let apply = false;
  let slug = DEFAULT_SLUG;
  let key: string | undefined;

  for (const arg of argv) {
    if (arg === "--apply") {
      apply = true;
    } else if (arg.startsWith("--slug=")) {
      slug = arg.slice("--slug=".length);
    } else if (arg.startsWith("--key=")) {
      key = arg.slice("--key=".length).replace(/^\/+/, "");
    } else if (arg === "--help" || arg === "-h") {
      console.log(usage);
      throw new Error("__help__");
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  return { apply, slug, key };
};

const presenceOf = async (key: string): Promise<Presence> => {
  const url = publicMediaUrl(key, null);
  if (!url) return "unknown";

  try {
    const response = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (response.ok) return "ok";
    if (response.status === 404 || response.status === 410) return "missing";
    return "unknown";
  } catch {
    return "unknown";
  }
};

const listProjectFiles = async (projectId: string): Promise<string[] | null> => {
  const imagekit = getImageKitStorage();
  if (!imagekit) return null;

  try {
    return await imagekit.listFolderPaths(`/projects/${projectId}`);
  } catch (error) {
    console.error(
      `Could not list /projects/${projectId} in ImageKit: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    return null;
  }
};

const main = async (): Promise<void> => {
  const args = parseArgs(process.argv.slice(2));

  if (env.storage.driver !== "imagekit") {
    console.error(
      `This script needs STORAGE_DRIVER=imagekit (current: ${env.storage.driver}).`,
    );
    process.exitCode = 1;
    return;
  }

  const project = await findProjectBySlug(args.slug);
  if (!project) {
    console.error(`No project found with slug "${args.slug}".`);
    process.exitCode = 1;
    return;
  }

  const before = {
    coverImage: project.coverImage,
    coverStorageKey: project.coverStorageKey,
  };

  console.log(`${args.apply ? "APPLY" : "DRY RUN"} — ${project.slug} (${project.id})`);
  console.log(`  cover_image       : ${before.coverImage ?? "(null)"}`);
  console.log(`  cover_storage_key : ${before.coverStorageKey ?? "(null)"}`);

  const files = await listProjectFiles(project.id);
  if (files === null) {
    console.log(`  ImageKit          : folder not listed`);
  } else {
    console.log(`  ImageKit          : ${files.length} file(s) in /projects/${project.id}`);
    for (const path of files) console.log(`    - ${path}`);
  }

  let targetKey: string | undefined;

  if (args.key) {
    targetKey = args.key;
  } else if (before.coverStorageKey) {
    const state = await presenceOf(before.coverStorageKey);
    if (state === "ok") {
      targetKey = before.coverStorageKey;
    } else if (state === "unknown") {
      console.error(
        "Refusing to change data: the stored key could not be verified (network or storage error).",
      );
      process.exitCode = 1;
      return;
    }
  }

  if (!targetKey && files !== null && files.length > 0) {
    const webp = files.filter((path) => path.toLowerCase().endsWith(".webp"));
    const candidates = webp.length > 0 ? webp : files;
    const first = candidates[0];
    if (candidates.length === 1 && first !== undefined) {
      targetKey = first.replace(/^\/+/, "");
      console.log(`  Using the only file in the folder: ${first}`);
    } else {
      console.error(
        `  ${candidates.length} candidate file(s); pass --key=<imagekit path> to choose one.`,
      );
    }
  }

  if (!targetKey) {
    console.error(
      "No file exists in ImageKit for this cover, so there is nothing to backfill.",
    );
    console.error(
      "Re-upload the cover through the admin flow (Projects → cover upload) so the row and ImageKit are written together.",
    );
    process.exitCode = 1;
    return;
  }

  const after = {
    coverImage: publicMediaUrl(targetKey, null),
    coverStorageKey: targetKey,
  };

  if (!after.coverImage) {
    console.error("The storage driver could not build a URL for that key.");
    process.exitCode = 1;
    return;
  }

  const changed =
    after.coverImage !== before.coverImage ||
    after.coverStorageKey !== before.coverStorageKey;

  console.log("Planned change:");
  console.log(`  cover_image       : ${after.coverImage}`);
  console.log(`  cover_storage_key : ${after.coverStorageKey}`);

  if (!changed) {
    console.log("Nothing to backfill: the row already matches ImageKit.");
    return;
  }

  const targetState = await presenceOf(targetKey);
  if (targetState !== "ok") {
    console.error(
      `Refusing to write: ${after.coverImage} responded "${targetState}" to HEAD.`,
    );
    process.exitCode = 1;
    return;
  }

  if (!args.apply) {
    console.log("Dry run only — no rows changed. Re-run with --apply to write it.");
    return;
  }

  const saved = await db.transaction(async (tx) => {
    const rows = await tx
      .update(projects)
      .set({
        coverImage: after.coverImage,
        coverStorageKey: after.coverStorageKey,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, project.id))
      .returning({
        id: projects.id,
        coverImage: projects.coverImage,
        coverStorageKey: projects.coverStorageKey,
      });

    const row = rows[0];
    if (rows.length !== 1 || !row) {
      throw new Error(
        `Expected to update exactly one row, updated ${rows.length}. Rolled back.`,
      );
    }
    return row;
  });

  console.log("Applied. After:");
  console.log(`  cover_image       : ${saved.coverImage ?? "(null)"}`);
  console.log(`  cover_storage_key : ${saved.coverStorageKey ?? "(null)"}`);
};

const describe = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

main()
  .then(async () => {
    await closeDatabase();
  })
  .catch(async (error: unknown) => {
    if (!(error instanceof Error) || error.message !== "__help__") {
      console.error(`backfill-project-cover failed: ${describe(error)}`);
      process.exitCode = 1;
    }
    await closeDatabase().catch(() => undefined);
  });
