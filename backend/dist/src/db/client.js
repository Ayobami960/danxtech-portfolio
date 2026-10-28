import net from "node:net";
import ws from "ws";
import { neonConfig, Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";
import * as schema from "../database/schema.js";
net.setDefaultAutoSelectFamilyAttemptTimeout(5_000);
neonConfig.webSocketConstructor = ws;
export const pool = new Pool({
    connectionString: env.databaseUrl,
    connectionTimeoutMillis: 15_000,
});
pool.on("error", (error) => {
    logger.error({ err: error }, "Unexpected PostgreSQL pool error");
});
export const db = drizzle(pool, { schema });
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
export const checkDatabase = async () => {
    await pool.query("SELECT 1");
};
export const connectDatabase = async (maxAttempts = 5) => {
    for (let attempt = 1;; attempt++) {
        try {
            await checkDatabase();
            return;
        }
        catch (error) {
            if (attempt >= maxAttempts)
                throw error;
            const delay = Math.min(500 * 2 ** (attempt - 1), 5_000);
            logger.warn({ attempt, maxAttempts, delay }, "Database connection attempt failed. Retrying.");
            await sleep(delay);
        }
    }
};
export const closeDatabase = async () => {
    await pool.end();
};
//# sourceMappingURL=client.js.map