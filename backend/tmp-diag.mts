import "dotenv/config";
import ImageKit from "imagekit";

const publicKey = process.env.IMAGEKIT_PUBLIC_KEY ?? "";
const privateKey = process.env.IMAGEKIT_PRIVATE_KEY ?? "";
const urlEndpoint = process.env.IMAGEKIT_URL_ENDPOINT ?? "";

console.log("config", {
  publicKeySet: publicKey.length > 0,
  publicKeyPrefix: publicKey.slice(0, 6),
  publicKeyLooksPrivate: publicKey.startsWith("private_"),
  privateKeySet: privateKey.length > 0,
  privateKeyPrefix: privateKey.slice(0, 8),
  privateKeyLooksPrivate: privateKey.startsWith("private_"),
  urlEndpoint,
});

const client = new ImageKit({ publicKey, privateKey, urlEndpoint });

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

try {
  const result = await client.upload({
    file: png,
    fileName: "diag-test.png",
    folder: "/projects/diag",
    useUniqueFileName: false,
    overwriteFile: true,
  });
  console.log("UPLOAD OK", JSON.stringify(result));
} catch (error) {
  const e = error as Record<string, unknown> & {
    message?: string;
    name?: string;
    $ResponseMetadata?: unknown;
  };
  console.log("UPLOAD FAILED");
  console.log("  name:", e?.name);
  console.log("  message:", e?.message);
  console.log("  metadata:", JSON.stringify(e?.$ResponseMetadata));
  console.log("  body:", JSON.stringify(error));
}
