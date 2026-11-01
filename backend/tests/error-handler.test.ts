/**
 * These tests exercise the real `errorHandler` through a real Express app.
 * A mocked Drizzle/pg failure is thrown from a route; the assertions cover the
 * 503/500 body shape and prove no SQL, column name, param or stack leaks.
 */
process.env.NODE_ENV = "test";
process.env.LOG_LEVEL = "silent";
process.env.DATABASE_URL ??= "postgres://user:pass@127.0.0.1:5432/test";
process.env.COOKIE_SAMESITE = "lax";
process.env.CLOUDINARY_CLOUD_NAME ??= "test-cloud";
process.env.CLOUDINARY_API_KEY ??= "test-key";
process.env.CLOUDINARY_API_SECRET ??= "test-secret";

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

const express = (await import("express")).default;
const { errorHandler } = await import("../src/middleware/error.js");
const { AppError, ERROR_CODES, unauthorized } = await import(
  "../src/lib/errors.js"
);

const LEAK_MARKERS = [
  "select",
  "from",
  "password_hash",
  "totp",
  "params",
  "stack",
  "admin_users",
  "42703",
  "does not exist",
  "terminating connection",
];

const assertNoLeak = (body: unknown, raw: string): void => {
  const serialized = JSON.stringify(body);
  for (const marker of LEAK_MARKERS) {
    assert.ok(
      !serialized.toLowerCase().includes(marker.toLowerCase()),
      `response body leaked "${marker}": ${serialized}`,
    );
  }
  assert.ok(
    !raw.includes("Failed query"),
    "response contained a raw driver message",
  );
};

const app = express();

// Stand-in for pino-http's request id.
app.use((request, _response, next) => {
  (request as unknown as { id: string }).id = "req-test-123";
  next();
});

app.get("/db-down", () => {
  const driver = Object.assign(
    new Error("terminating connection due to administrator command"),
    { code: "57P01" },
  );
  throw Object.assign(
    new Error(
      'Failed query: select "id", "email", "password_hash", "totp_secret_enc", ' +
        '"failed_attempts" from "admin_users" where "admin_users"."id" = $1 ' +
        "limit $2 params: 11111111-1111-1111-1111-111111111111,1",
    ),
    { cause: driver },
  );
});

app.get("/db-connection-exception", () => {
  const inner = Object.assign(new Error("Connection terminated unexpectedly"), {
    code: "08006",
  });
  const outer = new Error("Failed query: select * from projects");
  outer.name = "DrizzleQueryError";
  throw Object.assign(outer, { cause: inner });
});

app.get("/bad-column", () => {
  throw Object.assign(new Error('column "nope" does not exist'), {
    code: "42703",
  });
});

app.get("/unauthorized", () => {
  throw unauthorized();
});

app.get("/validation", () => {
  throw new AppError(
    400,
    ERROR_CODES.VALIDATION_ERROR,
    "Enter a valid email.",
    [{ path: "email", message: "Enter a valid email." }],
  );
});

app.get("/rate-limited", () => {
  throw new AppError(
    429,
    ERROR_CODES.RATE_LIMITED,
    "Too many requests. Please try again later.",
  );
});

app.use(errorHandler);

let server: Server;
let base = "";

before(async () => {
  await new Promise<void>((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address() as AddressInfo;
  base = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

const call = async (path: string) => {
  const response = await fetch(`${base}${path}`);
  const raw = await response.text();
  return { response, raw, body: JSON.parse(raw) as Record<string, unknown> };
};

describe("central error handler", () => {
  it("returns 503 for a database outage without leaking SQL or params", async () => {
    const { response, raw, body } = await call("/db-down");
    const error = body.error as Record<string, unknown>;

    assert.equal(response.status, 503);
    assert.equal(error.code, "SERVICE_UNAVAILABLE");
    assert.equal(
      error.message,
      "The service is temporarily unavailable. Please try again.",
    );
    assert.equal(error.requestId, "req-test-123");
    assert.equal(response.headers.get("x-request-id"), "req-test-123");
    assert.equal(response.headers.get("retry-after"), "5");
    assertNoLeak(body, raw);
  });

  it("returns 503 for a Postgres class-08 connection exception", async () => {
    const { response, raw, body } = await call("/db-connection-exception");
    const error = body.error as Record<string, unknown>;

    assert.equal(response.status, 503);
    assert.equal(error.code, "SERVICE_UNAVAILABLE");
    assertNoLeak(body, raw);
  });

  it("returns a generic 500 for a forced query error", async () => {
    const { response, raw, body } = await call("/bad-column");
    const error = body.error as Record<string, unknown>;

    assert.equal(response.status, 500);
    assert.equal(error.code, "INTERNAL_ERROR");
    assert.equal(error.message, "Something went wrong. Please try again.");
    assert.equal(error.requestId, "req-test-123");
    assertNoLeak(body, raw);
    assert.ok(!raw.includes("column"));
  });

  it("keeps 401 generic", async () => {
    const { response, body } = await call("/unauthorized");
    const error = body.error as Record<string, unknown>;

    assert.equal(response.status, 401);
    assert.equal(error.code, "UNAUTHORIZED");
    assert.equal(error.message, "Not signed in.");
  });

  it("keeps field-level validation messages", async () => {
    const { response, body } = await call("/validation");
    const error = body.error as Record<string, unknown>;

    assert.equal(response.status, 400);
    assert.equal(error.code, "VALIDATION_ERROR");
    assert.deepEqual(error.fields, { email: "Enter a valid email." });
  });

  it("returns 429 through the same envelope", async () => {
    const { response, body } = await call("/rate-limited");
    const error = body.error as Record<string, unknown>;

    assert.equal(response.status, 429);
    assert.equal(error.code, "RATE_LIMITED");
    assert.equal(error.requestId, "req-test-123");
  });
});
