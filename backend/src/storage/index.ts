import { env } from "../config/env.js";
import { CloudinaryStorage } from "./cloudinary.storage.js";
import type { StorageDriver } from "./types.js";

let driver: CloudinaryStorage | undefined;

/**
 * Cloudinary is the only media storage provider. `config/env.ts` refuses to
 * boot without CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and
 * CLOUDINARY_API_SECRET, so this is a guard for anything that runs before the
 * environment is fully loaded, not a fallback to another driver.
 */
export const isStorageConfigured = (): boolean =>
  Boolean(
    env.cloudinary.cloudName &&
      env.cloudinary.apiKey &&
      env.cloudinary.apiSecret,
  );

export const getStorage = (): CloudinaryStorage => {
  driver ??= new CloudinaryStorage();
  return driver;
};

/**
 * Single source of truth for every media URL returned by the API. The stored
 * key is resolved through the driver, so the base is always the configured
 * Cloudinary delivery domain (or res.cloudinary.com) and never a URL frozen
 * into a row. Seed assets carry no key (or an "external/" key) and are served
 * by the public site, so their stored path is returned unchanged.
 */
export const publicMediaUrl = (
  storageKey: string | null,
  storedUrl: string | null,
  resourceType: "image" | "raw" = "image",
): string | null => {
  if (!storageKey || storageKey.startsWith("external/")) return storedUrl;
  return getStorage().publicUrl(storageKey, resourceType);
};

/**
 * Delete one stored object. Cloudinary assets are addressed by public_id, so
 * `fileId` is the preferred key; `key` is a legacy fallback that only older
 * rows can carry, and it is ignored when it does not look like a Cloudinary
 * public_id path.
 */
export const deleteStoredFile = async (target: {
  fileId?: string | null;
  key?: string | null;
  /** Raw (PDF) assets must be destroyed on the `raw` endpoint. */
  resourceType?: "image" | "raw";
}): Promise<void> => {
  const storage = getStorage();
  const resourceType = target.resourceType ?? "image";
  if (target.fileId) {
    await storage.deleteById(target.fileId, resourceType);
    return;
  }
  if (target.key && isCloudinaryPublicId(target.key)) {
    await storage.deleteById(target.key, resourceType);
  }
};

/** Only used by tests to point the driver at fresh credentials. */
export const resetStorage = (): void => {
  driver = undefined;
};

export type { StorageDriver };

/** A string is a Cloudinary-style public_id when it starts with `portfolio/`. */
const isCloudinaryPublicId = (value: string): boolean =>
  typeof value === "string" &&
  value.startsWith("portfolio/") &&
  !value.includes("..");

