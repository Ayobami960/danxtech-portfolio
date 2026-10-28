import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client, } from "@aws-sdk/client-s3";
import { assertSafeKey } from "./types.js";
export class S3StorageDriver {
    config;
    name = "s3";
    client;
    constructor(config) {
        this.config = config;
        this.client = new S3Client({
            endpoint: config.endpoint,
            region: config.region,
            forcePathStyle: config.forcePathStyle,
            credentials: {
                accessKeyId: config.accessKeyId,
                secretAccessKey: config.secretAccessKey,
            },
        });
    }
    async put(key, buffer, contentType) {
        assertSafeKey(key);
        await this.client.send(new PutObjectCommand({
            Bucket: this.config.bucket,
            Key: key,
            Body: buffer,
            ContentType: contentType,
            CacheControl: "public, max-age=31536000, immutable",
        }));
    }
    async getStream(key) {
        assertSafeKey(key);
        const result = await this.client.send(new GetObjectCommand({ Bucket: this.config.bucket, Key: key }));
        if (!result.Body) {
            throw new Error("Storage object has no body.");
        }
        return result.Body;
    }
    async delete(key) {
        assertSafeKey(key);
        await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
    }
    publicUrl(key) {
        assertSafeKey(key);
        return `${this.config.publicBaseUrl.replace(/\/+$/, "")}/${key}`;
    }
}
//# sourceMappingURL=s3.js.map