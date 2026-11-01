// lib/cloudinary.ts
import { API_BASE } from "../app/config";
import { store } from "../app/store";
import {
  ACCEPT_CHAT_ATTACHMENTS,
  ACCEPT_CLOUDINARY_IMAGES,
  ACCEPT_PDF,
  isAcceptedFile,
} from "../features/uploads/accept";

export type UploadKind = "cover" | "gallery" | "resume";
export type CloudinaryResourceType = "image" | "raw";

export type CloudinaryUploadResult = {
  /** Cloudinary `secure_url`. */
  url: string;
  /** Cloudinary `public_id`; always inside the `portfolio/` prefix. */
  publicId: string;
  resourceType: CloudinaryResourceType;
};

/** Cloudinary's upload cap this admin enforces before signing. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

const MEGABYTE = 1024 * 1024;

/** Accepted types per kind; identical to the pickers, extension fallback included. */
const LIMITS: Record<UploadKind, { accept: string; maxBytes: number }> = {
  cover: { accept: ACCEPT_CLOUDINARY_IMAGES, maxBytes: MAX_UPLOAD_BYTES },
  gallery: { accept: ACCEPT_CLOUDINARY_IMAGES, maxBytes: MAX_UPLOAD_BYTES },
  resume: { accept: ACCEPT_PDF, maxBytes: MAX_UPLOAD_BYTES },
};

/** Must match CSRF_COOKIE on the API; it is readable by design (double submit). */
const CSRF_COOKIE = "portfolio_csrf";

type SignResponse = {
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  resourceType: CloudinaryResourceType;
  params: Record<string, string>;
};

type CloudinaryUploadPayload = {
  secure_url?: string;
  public_id?: string;
  error?: { message?: string };
};

/** A required-field view of Cloudinary's answer, returned by `postToCloudinary`. */
type CloudinaryUploadData = { secure_url: string; public_id: string };

const readCookie = (name: string): string | null => {
  for (const part of document.cookie.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return decodeURIComponent(rest.join("="));
  }
  return null;
};

/**
 * Auth + CSRF headers for the signing API. The CSRF token is the one the app
 * keeps in memory and RTK Query sends on every mutation; reading the cookie is
 * only a fallback because the admin and the API can live on different origins,
 * where the cookie is not document-readable.
 */
const apiHeaders = (): Record<string, string> => {
  const csrf = store.getState().auth.csrfToken ?? readCookie(CSRF_COOKIE);
  return {
    accept: "application/json",
    "content-type": "application/json",
    ...(csrf ? { "x-csrf-token": csrf } : {}),
  };
};

const apiErrorMessage = async (response: Response): Promise<string> => {
  const body: unknown = await response.json().catch(() => null);
  if (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error?: { message?: unknown } }).error?.message === "string"
  ) {
    return (body as { error: { message: string } }).error.message;
  }
  return `Upload request failed (${response.status}).`;
};

const formatMb = (bytes: number): string =>
  `${(bytes / MEGABYTE).toFixed(bytes % MEGABYTE === 0 ? 0 : 1)} MB`;

/**
 * POST the signed form to Cloudinary with plain XHR: no headers, no cookies and
 * no manual Content-Type, so the browser sets the multipart boundary itself.
 * The API secret never leaves the server; only the signature is used here.
 */
const postToCloudinary = async (
  signed: SignResponse,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<CloudinaryUploadData> => {
  const form = new FormData();
  // Every signed param must be forwarded unchanged, or Cloudinary rejects the
  // signature. The API returns only the preset params; the rest go below.
  for (const [key, value] of Object.entries(signed.params)) {
    form.append(key, value);
  }
  form.append("api_key", signed.apiKey);
  form.append("timestamp", String(signed.timestamp));
  form.append("signature", signed.signature);
  form.append("file", file, file.name);

  const data = await new Promise<CloudinaryUploadData>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `https://api.cloudinary.com/v1_1/${signed.cloudName}/${signed.resourceType}/upload`,
      true,
    );

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable && event.total > 0) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
    }

    xhr.onload = () => {
      let payload: CloudinaryUploadPayload;
      try {
        payload = xhr.responseText
          ? (JSON.parse(xhr.responseText) as CloudinaryUploadPayload)
          : {};
      } catch {
        payload = {};
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        if (
          typeof payload.secure_url !== "string" ||
          typeof payload.public_id !== "string"
        ) {
          reject(
            new Error("Cloudinary did not return the expected upload result."),
          );
          return;
        }
        onProgress?.(100);
        resolve({ secure_url: payload.secure_url, public_id: payload.public_id });
        return;
      }

      const message =
        payload.error?.message ?? `Cloudinary upload failed (${xhr.status}).`;
      // Cloudinary answers 403 when the API key itself is not allowed to create
      // assets, which no amount of retrying or signing will fix.
      reject(
        new Error(
          xhr.status === 403
            ? `${message} — enable the upload (create) permission for this API key in the Cloudinary console.`
            : message,
        ),
      );
    };
    xhr.onerror = () => {
      reject(new Error("Could not reach Cloudinary. Check your connection."));
    };
    xhr.onabort = () => {
      reject(new Error("The upload was cancelled."));
    };

    xhr.send(form);
  });

  return data;
};

/**
 * Upload one file straight from the browser to Cloudinary:
 *   1. `POST /api/v1/uploads/sign` with the kind, authenticated by the session
 *      cookie plus the CSRF header.
 *   2. Build the `FormData` from **every** returned param (the signature covers
 *      all of them), then `api_key`, `timestamp`, `signature` and the file.
 *   3. POST it to Cloudinary with plain XHR.
 */
export async function uploadToCloudinary(
  file: File,
  kind: UploadKind,
  onProgress?: (percent: number) => void,
): Promise<CloudinaryUploadResult> {
  const limit = LIMITS[kind];

  // Same check the dropzone runs, so a file it accepted (including one whose
  // browser MIME type is empty) is never rejected here.
  if (!isAcceptedFile(file, limit.accept)) {
    const expected =
      kind === "resume" ? "PDF" : "JPEG, PNG or WebP";
    throw new Error(`${file.name}: only ${expected} files can be uploaded here.`);
  }
  if (file.size > limit.maxBytes) {
    throw new Error(`${file.name}: the file must be ${formatMb(limit.maxBytes)} or smaller.`);
  }

  const signResponse = await fetch(`${API_BASE}/uploads/sign`, {
    method: "POST",
    credentials: "include",
    headers: apiHeaders(),
    body: JSON.stringify({ kind }),
  });

  if (!signResponse.ok) {
    throw new Error(await apiErrorMessage(signResponse));
  }

  const signed = (await signResponse.json()) as SignResponse;
  const data = await postToCloudinary(signed, file, onProgress);

  return {
    url: data.secure_url,
    publicId: data.public_id,
    resourceType: signed.resourceType,
  };
}

/** Chat attachment after upload: key, preview URL, name and type. */
export type ChatAttachmentUpload = {
  key: string;
  url: string;
  name: string;
  mimeType: string;
};

/**
 * Upload one chat attachment into the conversation's own Cloudinary folder.
 * The signature is scoped server-side to `chat/<conversationId>`, so this can
 * only ever write into the conversation it was requested for.
 */
export async function uploadChatAttachment(
  conversationId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<ChatAttachmentUpload> {
  if (!isAcceptedFile(file, ACCEPT_CHAT_ATTACHMENTS)) {
    throw new Error(`${file.name}: only images or PDFs can be sent here.`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`${file.name}: the file must be ${formatMb(MAX_UPLOAD_BYTES)} or smaller.`);
  }

  const resourceType: CloudinaryResourceType = file.type.startsWith("image/")
    ? "image"
    : "raw";

  const signResponse = await fetch(`${API_BASE}/uploads/sign`, {
    method: "POST",
    credentials: "include",
    headers: apiHeaders(),
    body: JSON.stringify({ kind: "chat", conversationId, resourceType }),
  });

  if (!signResponse.ok) {
    throw new Error(await apiErrorMessage(signResponse));
  }

  const signed = (await signResponse.json()) as SignResponse;
  const data = await postToCloudinary(signed, file, onProgress);

  return {
    key: data.public_id,
    url: data.secure_url,
    name: file.name,
    mimeType: file.type || (resourceType === "image" ? "image/jpeg" : "application/pdf"),
  };
}

/**
 * Delete one Cloudinary object by public_id through the API (the secret stays
 * server-side). An empty publicId is a no-op, matching the API's behaviour.
 */
export async function deleteFromCloudinary(
  publicId: string | null | undefined,
  resourceType: CloudinaryResourceType = "image",
): Promise<void> {
  if (!publicId) return;

  const response = await fetch(`${API_BASE}/uploads/delete`, {
    method: "POST",
    credentials: "include",
    headers: apiHeaders(),
    body: JSON.stringify({ publicId, resourceType }),
  });

  if (!response.ok) {
    throw new Error(await apiErrorMessage(response));
  }
}
