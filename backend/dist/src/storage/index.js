import { env } from "../config/env.js";
import { ImageKitStorage } from "./imagekit.storage.js";
import { LocalStorageDriver } from "./local.js";
import { S3StorageDriver } from "./s3.js";
let driver;
const createDriver = () => {
    if (env.storage.driver === "imagekit" && env.storage.imagekit) {
        return new ImageKitStorage(env.storage.imagekit);
    }
    if (env.storage.driver === "s3" && env.storage.s3) {
        return new S3StorageDriver(env.storage.s3);
    }
    return new LocalStorageDriver(env.storage.localDir, env.storage.publicMediaBaseUrl);
};
export const getStorage = () => {
    driver ??= createDriver();
    return driver;
};
/**
 * ImageKit-specific helpers (folder listings) for the storage integrity check.
 * Returns undefined for every other driver, so callers stay driver-agnostic.
 */
export const getImageKitStorage = () => {
    const storage = getStorage();
    return storage instanceof ImageKitStorage ? storage : undefined;
};
/**
 * Single source of truth for every media URL returned by the API. The stored
 * key is resolved through the active driver, so the base is always the
 * configured endpoint (IMAGEKIT_END_POINT) and never a URL frozen into a row.
 * Seed assets carry no key (or an "external/" key) and are served by the
 * public site, so their stored path is returned unchanged.
 */
export const publicMediaUrl = (storageKey, storedUrl) => {
    if (!storageKey || storageKey.startsWith("external/"))
        return storedUrl;
    return getStorage().publicUrl(storageKey);
};
/** Only used by tests to point the driver at a fresh directory. */
export const resetStorage = () => {
    driver = undefined;
};
//# sourceMappingURL=index.js.map