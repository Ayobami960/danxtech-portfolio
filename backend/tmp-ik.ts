/* Temporary harness: exercise the ImageKit driver with STORAGE_DRIVER=imagekit. */
import { readFileSync } from "node:fs";
import { AppError } from "./src/lib/errors.js";
import { getStorage } from "./src/storage/index.js";

const storage = getStorage();
console.log("driver:", storage.name);

const png = readFileSync("/tmp/diag120.png");

try {
  const stored = await storage.put(
    `projects/diag/${Date.now()}.webp`,
    png,
    "image/webp",
  );
  console.log("UPLOAD OK", JSON.stringify(stored));
} catch (error) {
  console.log(
    "CLIENT SEES:",
    error instanceof AppError
      ? JSON.stringify({
          status: error.statusCode,
          code: error.code,
          message: error.message,
        })
      : String(error),
  );
}
