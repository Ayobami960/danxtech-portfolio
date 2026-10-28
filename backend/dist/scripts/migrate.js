import "dotenv/config";
import { migrateDatabase } from "../src/db/migrate.js";
const run = async () => {
    const url = process.env.DATABASE_URL;
    if (!url) {
        throw new Error("DATABASE_URL is required to apply migrations.");
    }
    await migrateDatabase(url);
    console.log("Migrations applied.");
};
run().catch((error) => {
    console.error(`Migration failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
});
//# sourceMappingURL=migrate.js.map