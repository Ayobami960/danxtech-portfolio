import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  errorDetails,
  errorMessage,
  FRIENDLY,
  getFieldErrors,
  isTransientError,
  networkFailure,
  normalizeError,
} from "../src/api/errors.ts";

const SQL_LEAK =
  'Failed query: select "id", "email", "password_hash", "totp_secret_enc" ' +
  'from "admin_users" where "admin_users"."id" = $1 limit $2 params: ' +
  "11111111-1111-1111-1111-111111111111,1";

const envelope = (error: Record<string, unknown>): Record<string, unknown> => ({
  error,
});

describe("normalizeError / errorMessage", () => {
  it("maps FETCH_ERROR to the offline copy", () => {
    const normalized = normalizeError("FETCH_ERROR", null);
    assert.equal(normalized.code, "NETWORK");
    assert.equal(normalized.message, FRIENDLY.offline);
    assert.equal(errorMessage(normalized), FRIENDLY.offline);
  });

  it("maps 503 to the unavailable copy and keeps the request id", () => {
    const normalized = normalizeError(
      503,
      envelope({
        code: "SERVICE_UNAVAILABLE",
        message: SQL_LEAK,
        requestId: "req-abc",
      }),
    );
    assert.equal(normalized.message, FRIENDLY.unavailable);
    assert.equal(normalized.requestId, "req-abc");
    assert.ok(!normalized.message.includes("select"));
  });

  it("maps 500 to the generic server copy", () => {
    const normalized = normalizeError(
      500,
      envelope({ code: "INTERNAL_ERROR", message: SQL_LEAK }),
    );
    assert.equal(normalized.message, FRIENDLY.server);
    assert.equal(errorMessage(normalized), FRIENDLY.server);
  });

  it("maps 401 to the session copy", () => {
    const normalized = normalizeError(
      401,
      envelope({ code: "UNAUTHORIZED", message: "Not signed in." }),
    );
    assert.equal(normalized.message, FRIENDLY.session);
  });

  it("shows a field-level validation message", () => {
    const normalized = normalizeError(
      400,
      envelope({
        code: "VALIDATION_ERROR",
        message: "Request validation failed.",
        fields: { email: "Enter a valid email." },
      }),
    );
    assert.equal(normalized.message, "Enter a valid email.");
    assert.deepEqual(getFieldErrors(normalized), {
      email: "Enter a valid email.",
    });
  });

  it("replaces a raw SQL string with generic copy", () => {
    const normalized = normalizeError(
      500,
      envelope({ code: "INTERNAL_ERROR", message: SQL_LEAK }),
    );
    assert.equal(errorMessage(normalized), FRIENDLY.server);

    // Even an unknown-shaped error carrying SQL is discarded.
    assert.equal(
      errorMessage({ message: SQL_LEAK }),
      FRIENDLY.generic,
    );
    assert.equal(
      errorMessage(new Error(SQL_LEAK), "Fallback copy."),
      "Fallback copy.",
    );
  });

  it("falls back for unknown shapes", () => {
    assert.equal(errorMessage(undefined), FRIENDLY.generic);
    assert.equal(errorMessage({ foo: "bar" }, "Custom fallback."), "Custom fallback.");
  });
});

describe("errorDetails", () => {
  it("returns a friendly title, message and reference", () => {
    const details = errorDetails(
      normalizeError(
        503,
        envelope({
          code: "SERVICE_UNAVAILABLE",
          message: SQL_LEAK,
          requestId: "req-xyz",
        }),
      ),
    );
    assert.equal(details.title, "Service temporarily unavailable");
    assert.equal(details.message, FRIENDLY.unavailable);
    assert.equal(details.requestId, "req-xyz");
  });

  it("labels offline and 500 states distinctly", () => {
    assert.equal(errorDetails(normalizeError("FETCH_ERROR", null)).title, "You're offline");
    assert.equal(
      errorDetails(
        normalizeError(500, envelope({ code: "INTERNAL_ERROR", message: "boom" })),
      ).title,
      "Something went wrong on our side",
    );
  });
});

describe("networkFailure", () => {
  it("labels a blocked request distinctly from being offline", () => {
    const blocked = networkFailure(true);
    assert.equal(blocked.code, "NETWORK_BLOCKED");
    assert.equal(errorMessage(blocked), FRIENDLY.blocked);

    const details = errorDetails(blocked);
    assert.equal(details.title, "Can't reach the API");
    assert.notEqual(details.message, FRIENDLY.unavailable);
  });

  it("keeps the offline copy when the browser reports offline", () => {
    const offline = networkFailure(false);
    assert.equal(offline.code, "NETWORK");
    assert.equal(errorDetails(offline).title, "You're offline");
  });

  it("never signs the admin out on a blocked request", () => {
    assert.equal(isTransientError(networkFailure(true)), true);
    assert.equal(isTransientError(networkFailure(false)), true);
  });
});

describe("isTransientError", () => {
  it("treats network and 5xx failures as transient", () => {
    assert.equal(isTransientError(normalizeError("FETCH_ERROR", null)), true);
    assert.equal(
      isTransientError(normalizeError(503, envelope({ code: "SERVICE_UNAVAILABLE" }))),
      true,
    );
    assert.equal(
      isTransientError(normalizeError(500, envelope({ code: "INTERNAL_ERROR" }))),
      true,
    );
  });

  it("does not treat a 401 as transient", () => {
    assert.equal(
      isTransientError(normalizeError(401, envelope({ code: "UNAUTHORIZED" }))),
      false,
    );
  });
});
