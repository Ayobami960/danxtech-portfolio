/**
 * Per-route accept lists. These mirror the server allow-lists exactly:
 * the resume route takes PDF only, project covers and gallery images take
 * JPEG, PNG, WebP, GIF or AVIF. The `accept` attribute and the client-side
 * check both read from these constants so they cannot drift apart.
 */
export const ACCEPT_PDF = "application/pdf";
export const ACCEPT_IMAGES = "image/jpeg,image/png,image/webp,image/gif,image/avif";
/**
 * What the Cloudinary signed presets accept for covers and gallery images. The
 * upload helper enforces the same list, so the picker never offers a file the
 * upload would reject.
 */
export const ACCEPT_CLOUDINARY_IMAGES = "image/jpeg,image/png,image/webp";

/**
 * Browsers report an empty `file.type` (or "application/octet-stream") for
 * files that come from removable or network drives, for `.avif` on some
 * platforms, and for extensions the OS has no MIME mapping for. The extension
 * fallback therefore needs to know the extensions behind each accepted MIME
 * type, otherwise a valid PDF/PNG with no declared type is rejected.
 */
const EXTENSIONS_BY_MIME_TYPE: Readonly<Record<string, readonly string[]>> = {
  "application/pdf": [".pdf"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "image/gif": [".gif"],
  "image/avif": [".avif"],
};

const OCTET_STREAM = "application/octet-stream";

/** Structural subset of `File`, so this stays testable and React-free. */
export type AcceptableFile = {
  name: string;
  type: string;
};

type ParsedAccept = {
  /** Lowercased MIME types, possibly with a wildcard subtype such as "image". */
  mimeTypes: string[];
  /** Lowercased extensions with the leading dot, such as ".pdf". */
  extensions: string[];
};

/**
 * An accept value is a comma-separated list of MIME types and/or ".ext"
 * tokens. It must be split before comparing: treating the whole list as one
 * pattern made every multi-type list reject every file.
 */
const parseAccept = (accept: string): ParsedAccept => {
  const mimeTypes: string[] = [];
  const extensions: string[] = [];

  for (const raw of accept.split(",")) {
    const token = raw.trim().toLowerCase();
    if (token === "") continue;
    if (token.startsWith(".")) {
      extensions.push(token);
    } else {
      mimeTypes.push(token);
    }
  }

  return { mimeTypes, extensions };
};

const extensionOf = (fileName: string): string => {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
};

const matchesMimeType = (declaredType: string, mimeTypes: string[]): boolean =>
  mimeTypes.some((mime) =>
    mime.endsWith("/*")
      ? declaredType.startsWith(mime.slice(0, mime.length - 1))
      : declaredType === mime,
  );

/**
 * Client-side pre-check only: extension AND declared type, with an extension
 * fallback when the browser sends no usable type. The server makes the final
 * decision from the file's magic bytes, so this never needs to be trusted.
 */
export const isAcceptedFile = (file: AcceptableFile, accept: string): boolean => {
  const { mimeTypes, extensions } = parseAccept(accept);
  const declaredType = file.type.trim().toLowerCase();
  const usableType = declaredType !== "" && declaredType !== OCTET_STREAM;

  if (usableType && matchesMimeType(declaredType, mimeTypes)) return true;

  const extension = extensionOf(file.name);
  if (extension === "") return false;
  if (extensions.includes(extension)) return true;

  // A declared but unrecognised type (for example "text/plain" on a renamed
  // .txt) is a real signal: do not let the extension override it.
  if (usableType) return false;

  return mimeTypes.some((mime) =>
    (EXTENSIONS_BY_MIME_TYPE[mime] ?? []).includes(extension),
  );
};
