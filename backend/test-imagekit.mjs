// Run from your project root:
//   node --env-file=.env test-imagekit.mjs
import ImageKit from "imagekit";

const { IMAGEKIT_PUBLIC_KEY, IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT } =
  process.env;

console.log("Env check:", {
  IMAGEKIT_PUBLIC_KEY: Boolean(IMAGEKIT_PUBLIC_KEY),
  IMAGEKIT_PRIVATE_KEY: Boolean(IMAGEKIT_PRIVATE_KEY),
  IMAGEKIT_URL_ENDPOINT: IMAGEKIT_URL_ENDPOINT,
});

if (!IMAGEKIT_PUBLIC_KEY || !IMAGEKIT_PRIVATE_KEY || !IMAGEKIT_URL_ENDPOINT) {
  console.error("One or more env vars are missing. Check your .env file.");
  process.exit(1);
}

const client = new ImageKit({
  publicKey: IMAGEKIT_PUBLIC_KEY,
  privateKey: IMAGEKIT_PRIVATE_KEY,
  urlEndpoint: IMAGEKIT_URL_ENDPOINT,
});

// 1x1 transparent PNG
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

const key = "test/imagekit-test.png";

try {
  console.log("\n1) Uploading test image...");
  const uploaded = await client.upload({
    file: png,
    fileName: "imagekit-test.png",
    folder: "/test",
    useUniqueFileName: false,
    overwriteFile: true,
  });
  console.log("Upload OK:", {
    fileId: uploaded.fileId,
    filePath: uploaded.filePath,
    url: uploaded.url,
  });

  const configured = new URL(IMAGEKIT_URL_ENDPOINT).origin;
  const delivered = new URL(uploaded.url).origin;
  console.log("\n2) Endpoint check:");
  console.log("  configured:", configured);
  console.log("  delivered :", delivered);
  console.log(
    configured === delivered
      ? "  MATCH"
      : "  MISMATCH -> fix IMAGEKIT_URL_ENDPOINT to the delivered origin",
  );
  console.log(
    "  path check:",
    uploaded.filePath === `/${key}` ? "MATCH" : `MISMATCH (${uploaded.filePath})`,
  );

  console.log("\n3) Fetching the delivery URL...");
  const res = await fetch(uploaded.url);
  console.log("  HTTP status:", res.status);

  console.log("\n4) Cleaning up...");
  await client.deleteFile(uploaded.fileId);
  console.log("  Deleted test file.");

  console.log("\nImageKit is working with these credentials.");
} catch (error) {
  // The SDK rejects with the response body for HTTP errors.
  console.error("\nFAILED");
  console.error("statusCode:", error?.$ResponseMetadata?.statusCode ?? error?.statusCode);
  console.error("message   :", error?.message ?? error?.help);
  console.error("code      :", error?.code);
  console.error("requestId :", error?.$ResponseMetadata?.headers?.["x-ik-requestid"]);
  process.exit(1);
}
