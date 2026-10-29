import type { Readable } from "node:stream";

/** What a driver returns for a stored object. */
export type StoredFile = {
  /** Path inside the bucket/CDN (ImageKit filePath, without the leading slash). */
  key: string;
  /** Full public URL to display. */
  url: string;
  /**
   * ImageKit's fileId, used to delete the object without a lookup. Null only
   * for rows written before it was stored.
   */
  fileId: string | null;
};

export interface StorageDriver {
  readonly name: "imagekit";
  put(key: string, buffer: Buffer, contentType: string): Promise<StoredFile>;
  getStream(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  /** Delete using the fileId captured at upload time. */
  deleteById(fileId: string): Promise<void>;
  publicUrl(key: string): string;
}

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
