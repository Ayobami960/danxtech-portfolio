// storage/cloudinary.storage.ts
import crypto from "node:crypto";
import type { Readable } from "node:stream";
import { logger } from "../config/logger.js";
import { AppError, ERROR_CODES } from "../lib/errors.js";
import type { StorageDriver } from "./types.js";

/** Client-facing message for 5xx / transient Cloudinary errors. */
const UNAVAILABLE_MESSAGE =
  "Image storage is unavailable right now. Please try again.";

export const CLOUDINARY_BASE_URL = "https://api.cloudinary.com";
export const CLOUDINARY_UPLOAD_HOST = "api.cloudinary.com";
export const CLOUDINARY_RES_DOMAIN = "res.cloudinary.com";

export type ResourceType = "image" | "raw";

/**
 * Legacy config shape kept only so storage/index.ts keeps compiling.
 * This driver never reads it. Remove once nothing imports it.
 */
export type CloudinaryConfig = {
  publicKey: string;
  privateKey: string;
  urlEndpoint: string;
};

export type CloudinaryEnv = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  /** Optional custom delivery domain, e.g. https://cdn.example.com */
  deliveryUrl?: string | undefined;
};

/** Single source of truth for Cloudinary credentials. */
const cloudinaryEnv = (): CloudinaryEnv => {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.",
    );
  }
  const deliveryUrl = process.env.CLOUDINARY_DELIVERY_URL || undefined;
  return { cloudName, apiKey, apiSecret, deliveryUrl };
};

const PRESETS = {
  cover: {
    resourceType: "image" as const,
    params: { folder: "portfolio/projects/covers" },
  },
  gallery: {
    resourceType: "image" as const,
    params: { folder: "portfolio/projects/gallery" },
  },
  resume: {
    resourceType: "raw" as const,
    params: {
      folder: "portfolio/resume",
      public_id: "resume.pdf",
      overwrite: "true",
      invalidate: "true",
    },
  },
} as const;

export type Kind = keyof typeof PRESETS;

export const isKind = (k: unknown): k is Kind =>
  typeof k === "string" && Object.prototype.hasOwnProperty.call(PRESETS, k);

/**
 * Cloudinary signature: sha1(sortedParams + apiSecret), hex.
 * Params are sorted alphabetically and joined as key=value with "&".
 * file, api_key, cloud_name and resource_type must never be included.
 */
const cloudinarySignParams = (
  params: Record<string, string>,
  apiSecret: string,
): string => {
  const payload = Object.entries(params)
    .filter(([, value]) => value !== "")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
  return crypto
    .createHash("sha1")
    .update(payload + apiSecret)
    .digest("hex");
};

/**
 * Signed upload parameters for a direct browser -> Cloudinary upload.
 * `kind` decides folder, public_id and resource type, and is enforced here.
 *
 * The client must send: every key in `params`, plus api_key, timestamp,
 * signature and file.
 */
export const signCloudinaryUpload = async (
  kind: Kind,
): Promise<{
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  resourceType: ResourceType;
  params: Record<string, string>;
}> => {
  if (!isKind(kind)) {
    throw new Error("Invalid upload kind");
  }

  const { cloudName, apiKey, apiSecret } = cloudinaryEnv();
  const preset = PRESETS[kind];
  const timestamp = Math.round(Date.now() / 1000);

  const params: Record<string, string> = { ...preset.params };
  const signature = cloudinarySignParams(
    { ...params, timestamp: String(timestamp) },
    apiSecret,
  );

  return {
    signature,
    timestamp,
    apiKey,
    cloudName,
    resourceType: preset.resourceType,
    params, // preset params only; the client adds api_key, timestamp, signature
  };
};

/**
 * Signed upload parameters for a chat attachment. The folder is scoped to the
 * conversation (`chat/<conversationId>`), so a signature can only ever write
 * into the conversation it was issued for. Images use `image`, documents
 * (PDFs) use `raw`.
 */
export const signChatUpload = async (
  conversationId: string,
  resourceType: ResourceType,
): Promise<{
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  resourceType: ResourceType;
  params: Record<string, string>;
}> => {
  if (!/^[0-9a-fA-F-]{36}$/.test(conversationId)) {
    throw new Error("Invalid conversation id");
  }

  const { cloudName, apiKey, apiSecret } = cloudinaryEnv();
  const timestamp = Math.round(Date.now() / 1000);
  const params: Record<string, string> = { folder: `chat/${conversationId}` };
  const signature = cloudinarySignParams(
    { ...params, timestamp: String(timestamp) },
    apiSecret,
  );

  return { signature, timestamp, apiKey, cloudName, resourceType, params };
};

export const cloudinaryDeletePublicId = async (
  publicId: string,
  resourceType: ResourceType = "image",
): Promise<{ result: "ok" | "not_found" }> => {
  // Legacy ImageKit rows have no publicId: nothing to delete.
  if (!publicId) return { result: "not_found" };

  // Portfolio assets plus chat attachments, one folder per conversation.
  if (
    !(publicId.startsWith("portfolio/") || publicId.startsWith("chat/")) ||
    publicId.includes("..")
  ) {
    throw new Error("Invalid publicId");
  }

  const { cloudName, apiKey, apiSecret } = cloudinaryEnv();
  const timestamp = String(Math.round(Date.now() / 1000));

  const signed: Record<string, string> = {
    invalidate: "true",
    public_id: publicId,
    timestamp,
  };
  const signature = cloudinarySignParams(signed, apiSecret);

  const body = new URLSearchParams({
    ...signed,
    api_key: apiKey,
    signature,
  });

  let response: Response;
  try {
    response = await fetch(
      `${CLOUDINARY_BASE_URL}/v1_1/${cloudName}/${resourceType}/destroy`,
      { method: "POST", body }, // form-encoded; fetch sets the Content-Type
    );
  } catch (err) {
    logger.error({ err }, "cloudinary destroy network error");
    throw new AppError(
      502,
      ERROR_CODES.SERVICE_UNAVAILABLE,
      UNAVAILABLE_MESSAGE,
    );
  }

  if (!response.ok) {
    logger.error(
      { status: response.status, body: await response.text() },
      "cloudinary destroy failed",
    );
    throw new AppError(
      502,
      ERROR_CODES.SERVICE_UNAVAILABLE,
      UNAVAILABLE_MESSAGE,
    );
  }

  const json = (await response.json()) as { result?: string } | null;
  // Cloudinary returns "ok" or "not found" (with a space).
  return { result: json?.result === "not found" ? "not_found" : "ok" };
};

export class CloudinaryStorage implements StorageDriver {
  readonly name = "cloudinary" as const;

  /** Uploads go browser -> Cloudinary via the signed endpoint. */
  async put(
    _key: string,
    _buffer: Buffer,
    _contentType: string,
  ): Promise<Awaited<ReturnType<StorageDriver["put"]>>> {
    throw new Error("CloudinaryStorage: use the signed upload endpoint");
  }

  /** Treats the key as a Cloudinary public_id (images). */
  async delete(key: string): Promise<void> {
    await cloudinaryDeletePublicId(key, "image");
  }

  async deleteById(
    fileId: string,
    resourceType: ResourceType = "image",
  ): Promise<void> {
    await cloudinaryDeletePublicId(fileId, resourceType);
  }

  async getStream(_key: string): Promise<Readable> {
    throw new Error("CloudinaryStorage: not used for Cloudinary URLs");
  }

  publicUrl(key: string, resourceType: ResourceType = "image"): string {
    const { cloudName, deliveryUrl } = cloudinaryEnv();
    // A custom delivery domain already maps to the cloud, so no cloud name.
    const base =
      deliveryUrl && deliveryUrl.startsWith("http")
        ? deliveryUrl.replace(/\/+$/, "")
        : `https://${CLOUDINARY_RES_DOMAIN}/${cloudName}`;
    return `${base}/${resourceType}/upload/${key.replace(/^\/+/, "")}`;
  }

  static async signUploadKind(kind: string) {
    return signCloudinaryUpload(kind as Kind);
  }

  static async deletePublicId(publicId: string, resourceType: ResourceType = "image") {
    return cloudinaryDeletePublicId(publicId, resourceType);
  }
}