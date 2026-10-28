import "dotenv/config";
import { Pool } from "@neondatabase/serverless";
import * as schema from "./schema.js";
export declare const pool: Pool;
export declare const db: import("drizzle-orm/neon-serverless").NeonDatabase<typeof schema> & {
    $client: Pool;
};
export declare const connectDatabase: (maxAttempts?: number) => Promise<void>;
export declare const disconnectDatabase: () => Promise<void>;
