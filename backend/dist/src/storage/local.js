import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertSafeKey } from "./types.js";
export class LocalStorageDriver {
    root;
    publicBaseUrl;
    name = "local";
    constructor(root, 
    /** Absolute origin that serves /media (needed when the frontend is on another domain). */
    publicBaseUrl) {
        this.root = root;
        this.publicBaseUrl = publicBaseUrl;
    }
    resolve(key) {
        assertSafeKey(key);
        const resolved = path.resolve(this.root, key);
        const root = path.resolve(this.root);
        if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
            throw new Error("Unsafe storage key.");
        }
        return resolved;
    }
    async put(key, buffer, _contentType) {
        const target = this.resolve(key);
        await mkdir(path.dirname(target), { recursive: true });
        await writeFile(target, buffer);
    }
    async getStream(key) {
        const target = this.resolve(key);
        return createReadStream(target);
    }
    async delete(key) {
        try {
            await unlink(this.resolve(key));
        }
        catch (error) {
            if (error.code === "ENOENT")
                return;
            throw error;
        }
    }
    publicUrl(key) {
        assertSafeKey(key);
        const path = `/media/${key}`;
        if (!this.publicBaseUrl)
            return path;
        return `${this.publicBaseUrl.replace(/\/+$/, "")}${path}`;
    }
}
//# sourceMappingURL=local.js.map