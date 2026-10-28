import type { Readable } from "node:stream";

export interface StorageDriver {
  readonly name: "local" | "s3" | "imagekit";
  put(key: string, buffer: Buffer, contentType: string): Promise<void>;
  getStream(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
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
