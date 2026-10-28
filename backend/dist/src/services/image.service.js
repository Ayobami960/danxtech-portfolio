import { fileTypeFromBuffer } from "file-type";
import sharp from "sharp";
import { AppError, ERROR_CODES } from "../lib/errors.js";
const ALLOWED_IMAGE_TYPES = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/avif",
]);
const MAX_NAME_IN_MESSAGE = 120;
const describe = (fileName) => {
    const name = fileName?.trim() ?? "";
    return name === ""
        ? "The uploaded file"
        : `"${name.slice(0, MAX_NAME_IN_MESSAGE)}"`;
};
/**
 * Never trust a filename or declared MIME type: sniff the magic bytes, then
 * re-encode to WebP (max 2000 px, EXIF and other metadata stripped).
 */
export const processImage = async (buffer, fileName) => {
    const detected = await fileTypeFromBuffer(buffer);
    if (!detected || !ALLOWED_IMAGE_TYPES.has(detected.mime)) {
        throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, `${describe(fileName)} is not an accepted image. Allowed types: JPEG, PNG, WebP, GIF, AVIF.`);
    }
    try {
        const output = await sharp(buffer, { failOn: "error" })
            .rotate()
            .resize({
            width: 2000,
            height: 2000,
            fit: "inside",
            withoutEnlargement: true,
        })
            .webp({ quality: 82 })
            .toBuffer();
        return { buffer: output, contentType: "image/webp", extension: "webp" };
    }
    catch {
        throw new AppError(400, ERROR_CODES.VALIDATION_ERROR, `${describe(fileName)} could not be processed as an image.`);
    }
};
//# sourceMappingURL=image.service.js.map