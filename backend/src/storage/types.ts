import type { Readable } from "node:stream";

/** What a driver returns for a stored object. */
export type StoredFile = {
  /** Path inside the bucket/CDN (ImageKit filePath, without the leading slash). */
  key: string;
  /** Full public URL to display. */
  url: string;
  /**
   * Provider-side id used to delete the file without a lookup. Only ImageKit
   * exposes one, so this is null for the local and S3 drivers.
   */
  fileId: string | null;
};

export interface StorageDriver {
  readonly name: "local" | "s3" | "imagekit";
  put(key: string, buffer: Buffer, contentType: string): Promise<StoredFile>;
  getStream(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  /**
   * Delete using the fileId captured at upload time. Only ImageKit implements
   * this; the other drivers throw instead of silently doing nothing.
   */
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
