import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import type { StorageDriver, StoredFile } from "./types.js";
import { assertSafeKey } from "./types.js";

export class LocalStorageDriver implements StorageDriver {
  readonly name = "local" as const;

  constructor(
    private readonly root: string,
    /** Absolute origin that serves /media (needed when the frontend is on another domain). */
    private readonly publicBaseUrl?: string,
  ) {}

  resolve(key: string): string {
    assertSafeKey(key);
    const resolved = path.resolve(this.root, key);
    const root = path.resolve(this.root);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
      throw new Error("Unsafe storage key.");
    }
    return resolved;
  }

  async put(
    key: string,
    buffer: Buffer,
    _contentType: string,
  ): Promise<StoredFile> {
    const target = this.resolve(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, buffer);
    return { key, url: this.publicUrl(key), fileId: null };
  }

  async getStream(key: string): Promise<Readable> {
    const target = this.resolve(key);
    return createReadStream(target);
  }

  async delete(key: string): Promise<void> {
    try {
      await unlink(this.resolve(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return;
      throw error;
    }
  }

  deleteById(_fileId: string): Promise<void> {
    return Promise.reject(
      new Error("The local storage driver cannot delete by file id."),
    );
  }

  publicUrl(key: string): string {
    assertSafeKey(key);
    const path = `/media/${key}`;
    if (!this.publicBaseUrl) return path;
    return `${this.publicBaseUrl.replace(/\/+$/, "")}${path}`;
  }
}
