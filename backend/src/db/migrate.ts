import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { fileURLToPath } from "node:url";

const MIGRATIONS_FOLDER = fileURLToPath(
  new URL("../../drizzle", import.meta.url),
);

/**
 * Apply the committed migrations in `drizzle/` to any database. Production uses
 * `npm run db:migrate` (drizzle-kit); the test suite and CI use this helper so
 * failures surface as real errors instead of a CLI spinner.
 */
export const migrateDatabase = async (
  connectionString: string,
): Promise<void> => {
  const pool = new pg.Pool({ connectionString, max: 1 });
  try {
    await migrate(drizzle(pool), { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    await pool.end();
  }
};
