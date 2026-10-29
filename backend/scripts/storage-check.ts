import "dotenv/config";
import { closeDatabase } from "../src/db/client.js";
import { runStorageIntegrityCheck } from "../src/services/storage-integrity.service.js";

/**
 * CI/deploy gate: exits non-zero when the database references files that are
 * not present in image storage. Safe to run at any time (read-only).
 */
const main = async (): Promise<void> => {
  const report = await runStorageIntegrityCheck();

  console.log(
    `Checked ${report.checked} stored key(s): ${report.ok} ok, ` +
      `${report.missing.length} missing, ${report.unknown.length} unverified.`,
  );

  for (const item of report.missing) {
    console.error(`MISSING   ${item.table} ${item.rowId} ${item.key}`);
  }
  for (const item of report.unknown) {
    console.error(
      `UNVERIFIED ${item.table} ${item.rowId} ${item.key} (${item.reason ?? "unknown"})`,
    );
  }

  if (report.missing.length > 0) process.exitCode = 1;
};

main()
  .then(async () => {
    await closeDatabase();
  })
  .catch(async (error: unknown) => {
    console.error(
      `storage:check failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
    await closeDatabase().catch(() => undefined);
  });
