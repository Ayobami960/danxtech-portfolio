/* Temporary verification harness for the image upload path — deleted after the run. */
import express from "express";
import { readFileSync } from "node:fs";
import { createApp } from "./src/app.js";
import { errorHandler } from "./src/middleware/error.js";
import {
  limitImageRequestBody,
  uploadSingleImage,
} from "./src/middleware/upload.js";

let failures = 0;
const check = (label: string, ok: boolean, detail = ""): void => {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};

const png = readFileSync("/tmp/diag120.png");

type Reply = { status: number; json: Record<string, unknown> | null; text: string };

const postFile = async (
  url: string,
  bytes: Buffer,
  fileName: string,
  type: string,
  headers: Record<string, string> = {},
): Promise<Reply> => {
  const form = new FormData();
  form.append("file", new Blob([bytes], { type }), fileName);
  const response = await fetch(url, { method: "POST", body: form, headers });
  const text = await response.text();
  let json: Record<string, unknown> | null = null;
  try {
    json = text ? (JSON.parse(text) as Record<string, unknown>) : null;
  } catch {
    json = null;
  }
  return { status: response.status, json, text };
};

const run = async (): Promise<void> => {
  /* 1. The upload middlewares on their own, behind the same JSON parser. */
  const mini = express();
  mini.use(express.json({ limit: "100kb" }));
  mini.post(
    "/cover",
    limitImageRequestBody,
    uploadSingleImage,
    (request, response) => {
      const file = request.file as
        | { buffer?: Buffer; mimetype?: string }
        | undefined;
      response.json({
        size: file?.buffer?.length ?? 0,
        type: file?.mimetype ?? null,
      });
    },
  );
  mini.use(errorHandler);

  const miniServer = mini.listen(0);
  const miniPort = (miniServer.address() as { port: number }).port;
  const miniUrl = `http://127.0.0.1:${miniPort}/cover`;

  const small = await postFile(miniUrl, png, "small.png", "image/png");
  check(
    "small image reaches the handler as a buffer",
    small.status === 200 && small.json?.size === png.length,
    `status=${small.status} body=${small.text}`,
  );

  const notImage = await postFile(
    miniUrl,
    Buffer.from("not an image at all"),
    "notes.txt",
    "text/plain",
  );
  check(
    "non-image is rejected with 400 and a readable message",
    notImage.status === 400 &&
      String(notImage.text).includes("is not an image"),
    `status=${notImage.status} body=${notImage.text}`,
  );

  const overPerFile = await postFile(
    miniUrl,
    Buffer.alloc(4.2 * 1024 * 1024, 1),
    "big.png",
    "image/png",
  );
  check(
    "4.2 MB image gets a 413 naming the per-image limit",
    overPerFile.status === 413 &&
      String(overPerFile.text).includes("Each image must be 4 MB"),
    `status=${overPerFile.status} body=${overPerFile.text}`,
  );

  const overBody = await postFile(
    miniUrl,
    Buffer.alloc(5 * 1024 * 1024, 1),
    "huge.png",
    "image/png",
  );
  check(
    "request body above 4.5 MB gets a 413 naming the request limit",
    overBody.status === 413 &&
      String(overBody.text).includes("at most 4.5 MB"),
    `status=${overBody.status} body=${overBody.text}`,
  );

  await new Promise<void>((resolve) => miniServer.close(() => resolve()));

  /* 2. The real app: multipart must survive the global middleware stack. */
  const app = createApp();
  const appServer = app.listen(0);
  const appPort = (appServer.address() as { port: number }).port;
  const base = `http://127.0.0.1:${appPort}/api/v1`;

  const unauth = await postFile(
    `${base}/admin/projects/00000000-0000-4000-8000-000000000000/cover`,
    png,
    "small.png",
    "image/png",
    { origin: "http://localhost:5173" },
  );
  check(
    "real app: multipart POST reaches the route (401, not a body-parse error)",
    unauth.status === 401 &&
      (unauth.json?.error as { code?: string } | undefined)?.code ===
        "UNAUTHORIZED",
    `status=${unauth.status} body=${unauth.text}`,
  );

  await new Promise<void>((resolve) => appServer.close(() => resolve()));

  console.log(failures === 0 ? "ALL CHECKS PASSED" : `${failures} CHECK(S) FAILED`);
  process.exitCode = failures === 0 ? 0 : 1;
};

await run();
