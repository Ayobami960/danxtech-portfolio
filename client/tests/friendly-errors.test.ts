import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FRIENDLY,
  friendlyMessage,
  looksLikeInternalError,
  safeFieldErrors,
} from "../lib/api/friendly-errors.ts";

const SQL_LEAK =
  'Failed query: select "id", "email", "password_hash", "totp_secret_enc" ' +
  'from "admin_users" where "admin_users"."id" = $1 limit $2 params: ' +
  "11111111-1111-1111-1111-111111111111,1";

describe("friendlyMessage", () => {
  it("maps offline, 503, 5xx and 401 to local copy", () => {
    assert.equal(friendlyMessage("FETCH_ERROR", "NETWORK"), FRIENDLY.offline);
    assert.equal(
      friendlyMessage(503, "SERVICE_UNAVAILABLE"),
      FRIENDLY.unavailable,
    );
    assert.equal(friendlyMessage(500, "INTERNAL_ERROR"), FRIENDLY.server);
    assert.equal(friendlyMessage(401, "UNAUTHORIZED"), FRIENDLY.session);
  });

  it("uses a field message for validation errors", () => {
    assert.equal(
      friendlyMessage(400, "VALIDATION_ERROR", {
        email: "Enter a valid email.",
      }),
      "Enter a valid email.",
    );
    assert.equal(friendlyMessage(400, "VALIDATION_ERROR"), FRIENDLY.validation);
  });

  it("ignores codes it does not know", () => {
    assert.equal(friendlyMessage(0, "SEND_FAILED"), FRIENDLY.generic);
  });
});

describe("internal text detection", () => {
  it("flags SQL, driver and stack-shaped strings", () => {
    assert.equal(looksLikeInternalError(SQL_LEAK), true);
    assert.equal(looksLikeInternalError("ECONNREFUSED 127.0.0.1:5432"), true);
    assert.equal(looksLikeInternalError("    at query (/app/node_modules/pg/lib/client.js:10:11)"), true);
    assert.equal(looksLikeInternalError("Enter a valid email."), false);
  });

  it("drops leaked field messages but keeps real ones", () => {
    assert.deepEqual(
      safeFieldErrors({ email: "Enter a valid email.", sql: SQL_LEAK }),
      { email: "Enter a valid email." },
    );
    assert.equal(safeFieldErrors({ sql: SQL_LEAK }), undefined);
    assert.deepEqual(
      safeFieldErrors([{ path: "name", message: "Enter your name." }]),
      { name: "Enter your name." },
    );
  });
});
