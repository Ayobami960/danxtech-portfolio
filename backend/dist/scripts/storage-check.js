import "dotenv/config";
import { env } from "../src/config/env.js";
import { closeDatabase } from "../src/db/client.js";
import { runStorageIntegrityCheck } from "../src/services/storage-integrity.service.js";
/**
 * CI/deploy gate: exits non-zero when the database references files that are
 * not present in image storage. Safe to run at any time (read-only).
 */
const main = async () => {
    if (env.storage.driver !== "imagekit") {
        console.error(`storage:check needs STORAGE_DRIVER=imagekit (current: ${env.storage.driver}).`);
        process.exitCode = 1;
        return;
    }
    const report = await runStorageIntegrityCheck();
    console.log(`Checked ${report.checked} stored key(s): ${report.ok} ok, ` +
        `${report.missing.length} missing, ${report.unknown.length} unverified.`);
    for (const item of report.missing) {
        console.error(`MISSING   ${item.table} ${item.rowId} ${item.key}`);
    }
    for (const item of report.unknown) {
        console.error(`UNVERIFIED ${item.table} ${item.rowId} ${item.key} (${item.reason ?? "unknown"})`);
    }
    if (report.missing.length > 0)
        process.exitCode = 1;
};
main()
    .then(async () => {
    await closeDatabase();
})
    .catch(async (error) => {
    console.error(`storage:check failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
    await closeDatabase().catch(() => undefined);
});
//# sourceMappingURL=storage-check.js.map