import type { AdminUser } from "../database/schema.js";

declare global {
  namespace Express {
    interface Request {
      id: string;
      admin?: AdminUser;
      validated: {
        body: unknown;
        query: unknown;
        params: unknown;
      };
    }
  }
}

export {};
