import multer from "multer";
import type { NextFunction, RequestHandler } from "express";
import {
  MAX_CHAT_IMAGE_BYTES,
  MAX_GALLERY_IMAGES,
  MAX_IMAGE_BYTES,
  MAX_IMAGE_REQUEST_BYTES,
  MAX_RESUME_BYTES,
} from "../config/constants.js";
import { AppError, ERROR_CODES } from "../lib/errors.js";

/**
 * Every upload is held in memory and handed to the storage driver as a Buffer.
 * Nothing is written to disk: on Vercel the only writable path is /tmp, and it
 * does not survive the invocation, so a diskStorage upload would either throw
 * EROFS or vanish before the file could be uploaded to ImageKit.
 */
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_BYTES,
    files: MAX_GALLERY_IMAGES,
    fields: 10,
    // Multipart framing per part; a generous margin over a well-formed request.
    parts: MAX_GALLERY_IMAGES + 10,
  },
  fileFilter: (_request, file, callback) => {
    const declared = file.mimetype.toLowerCase();
    // Browsers occasionally report application/octet-stream; the magic-byte
    // check in processImage stays the authoritative image test either way.
    if (
      declared.startsWith("image/") ||
      declared === "application/octet-stream"
    ) {
      callback(null, true);
      return;
    }
    callback(
      new AppError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        `"${file.originalname.slice(0, 120)}" is not an image. Upload a JPEG, PNG, WebP, GIF or AVIF file.`,
      ),
    );
  },
});

const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_RESUME_BYTES,
    files: 1,
    fields: 5,
  },
});

const megabyteLabel = (bytes: number): string => {
  const megabytes = bytes / (1024 * 1024);
  return Number.isInteger(megabytes)
    ? `${megabytes} MB`
    : `${megabytes.toFixed(1)} MB`;
};

/**
 * multer reports an oversized part as a bare LIMIT_FILE_SIZE error, which says
 * nothing about the allowed size. Translate it into a readable 413.
 */
const withImageLimits =
  (middleware: RequestHandler): RequestHandler =>
  (request, response, next: NextFunction) => {
    middleware(request, response, (error?: unknown) => {
      if (
        error instanceof multer.MulterError &&
        error.code === "LIMIT_FILE_SIZE"
      ) {
        next(
          new AppError(
            413,
            ERROR_CODES.PAYLOAD_TOO_LARGE,
            `Each image must be ${megabyteLabel(MAX_IMAGE_BYTES)} or smaller.`,
          ),
        );
        return;
      }
      next(error);
    });
  };

/**
 * The platform rejects bodies above ~4.5 MB before the handler runs, with an
 * error the admin cannot display. Fail early with a message that names the
 * limit, so a too-large upload never looks like a storage outage.
 */
export const limitImageRequestBody: RequestHandler = (
  request,
  _response,
  next,
) => {
  const declared = Number(request.headers["content-length"]);

  if (Number.isFinite(declared) && declared > MAX_IMAGE_REQUEST_BYTES) {
    next(
      new AppError(
        413,
        ERROR_CODES.PAYLOAD_TOO_LARGE,
        `This upload is ${megabyteLabel(declared)}. A single request may carry at most ${megabyteLabel(MAX_IMAGE_REQUEST_BYTES)}; send fewer or smaller images (max ${megabyteLabel(MAX_IMAGE_BYTES)} per image).`,
      ),
    );
    return;
  }

  next();
};

export const uploadSingleImage = withImageLimits(imageUpload.single("file"));
export const uploadGalleryImages = withImageLimits(
  imageUpload.array("files", MAX_GALLERY_IMAGES),
);
export const uploadResume = resumeUpload.single("file");

const chatImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CHAT_IMAGE_BYTES, files: 1, fields: 3 },
});

export const uploadChatImage = chatImageUpload.single("file");
