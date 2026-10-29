import { env } from "../config/env.js";
import { ImageKitStorage } from "./imagekit.storage.js";
import type { StorageDriver } from "./types.js";

let driver: ImageKitStorage | undefined;

/**
 * ImageKit is the only media storage provider: `config/env.ts` refuses to boot
 * without its three variables, so this is a guard for anything that runs before
 * the environment is fully loaded, not a fallback to another driver.
 */
export const isStorageConfigured = (): boolean =>
  Boolean(
    env.storage.publicKey && env.storage.privateKey && env.storage.urlEndpoint,
  );

export const getStorage = (): ImageKitStorage => {
  driver ??= new ImageKitStorage(env.storage);
  return driver;
};

/** ImageKit-specific helpers (folder listings) for the storage integrity check. */
export const getImageKitStorage = (): ImageKitStorage => getStorage();

/**
 * Single source of truth for every media URL returned by the API. The stored
 * key is resolved through the driver, so the base is always the configured
 * endpoint (IMAGEKIT_URL_ENDPOINT) and never a URL frozen into a row.
 * Seed assets carry no key (or an "external/" key) and are served by the
 * public site, so their stored path is returned unchanged.
 */
export const publicMediaUrl = (
  storageKey: string | null,
  storedUrl: string | null,
): string | null => {
  if (!storageKey || storageKey.startsWith("external/")) return storedUrl;
  return getStorage().publicUrl(storageKey);
};

/**
 * Delete one stored object. The fileId captured at upload time is preferred
 * because it costs a single request; the key is only a fallback for rows
 * written before fileIds were stored.
 */
export const deleteStoredFile = async (target: {
  fileId?: string | null;
  key?: string | null;
}): Promise<void> => {
  const storage = getStorage();
  if (target.fileId) {
    await storage.deleteById(target.fileId);
    return;
  }
  if (target.key) {
    await storage.delete(target.key);
  }
};

/** Only used by tests to point the driver at fresh credentials. */
export const resetStorage = (): void => {
  driver = undefined;
};

export type { StorageDriver };
