import type { Readable } from "node:stream";

/** What a driver returns for a stored object. */
export type StoredFile = {
  /** Cloudinary public_id (for example `portfolio/projects/covers/xxx.webp`). */
  key: string;
  /** Full public URL to display. */
  url: string;
  /**
   * Cloudinary public_id, used to delete the object without a lookup.
   * For new Cloudinary uploads this equals `key`.
   */
  fileId: string | null;
};

export interface StorageDriver {
  readonly name: "cloudinary";
  /**
   * Not used by any current upload route: direct signed uploads go through
   * `POST /api/v1/uploads/sign` and a browser upload to Cloudinary.
   * Kept only so the driver interface stays complete.
   */
  put(key: string, buffer: Buffer, contentType: string): Promise<StoredFile>;
  getStream(key: string): Promise<Readable>;
  /**
   * Not used directly. Cloudinary deletions go through `deleteById` with the
   * public_id.
   */
  delete(key: string): Promise<void>;
  /** Delete using the Cloudinary public_id captured at upload time. */
  deleteById(fileId: string): Promise<void>;
  publicUrl(key: string): string;
}

/**
 * Legacy helper kept for any remaining code that asserts a storage key is safe.
 * Cloudinary public_ids are `folder/...` paths, never absolute paths, and must
 * not contain traversal components.
 */
export const assertSafeKey = (key: string): void => {
  if (
    !key ||
    key.startsWith("/") ||
    key.includes("..") ||
    key.includes("\\") ||
    key.includes("\0")
  ) {
    throw new Error("Unsafe storage key.");
  }
};
