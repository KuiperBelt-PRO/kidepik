import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeDisplayNameInput,
  resolveAccountDisplayName,
  resolveGoogleAccountName,
} from "../js/lib/account-display-name.js";

describe("account-display-name", () => {
  it("vacío → null", () => {
    assert.deepEqual(normalizeDisplayNameInput(""), { ok: true, value: null });
    assert.deepEqual(normalizeDisplayNameInput("  "), { ok: true, value: null });
  });

  it("válido", () => {
    assert.deepEqual(normalizeDisplayNameInput("Ada"), { ok: true, value: "Ada" });
    assert.deepEqual(normalizeDisplayNameInput("O'Connor"), { ok: true, value: "O'Connor" });
  });

  it("demasiado largo o caracteres inválidos", () => {
    assert.equal(normalizeDisplayNameInput("a".repeat(41)).ok, false);
    assert.equal(normalizeDisplayNameInput("ada@x").ok, false);
  });

  it("resolveAccountDisplayName prioriza display_name", () => {
    assert.equal(
      resolveAccountDisplayName({ display_name: "Ada", email: "a@b.com" }, null),
      "Ada",
    );
    assert.equal(
      resolveAccountDisplayName({ display_name: null, email: "padre@ejemplo.com" }, null),
      "padre",
    );
  });

  it("resolveGoogleAccountName lee metadata Google", () => {
    assert.equal(
      resolveGoogleAccountName({
        user: { user_metadata: { full_name: "Eduardo Serna" } },
      }),
      "Eduardo Serna",
    );
    assert.equal(resolveGoogleAccountName({ user: {} }), "—");
  });
});
