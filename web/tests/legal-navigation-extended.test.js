import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  resolveLegalBackNavigation,
  shouldAnimateLegalEntry,
  shouldResumeShellTransition,
  isLegalRoutePath,
} from "../js/lib/legal-navigation.js";

describe("legal-navigation helpers", () => {
  it("resolveLegalBackNavigation", () => {
    assert.deepEqual(resolveLegalBackNavigation(true), {
      mode: "authenticated-home",
      path: "/home",
    });
    assert.deepEqual(resolveLegalBackNavigation(false), {
      mode: "auth-handoff",
      path: "/loader",
    });
  });

  it("shouldAnimateLegalEntry", () => {
    assert.equal(
      shouldAnimateLegalEntry({ snapshot: { logo: {} }, intent: { to: "legal" } }),
      true,
    );
    assert.equal(
      shouldAnimateLegalEntry({ snapshot: null, intent: { to: "legal" } }),
      false,
    );
  });

  it("shouldResumeShellTransition", () => {
    assert.equal(
      shouldResumeShellTransition({
        snapshot: { bandsAlreadyExpanded: true },
        intent: { resumeShell: true },
      }),
      true,
    );
    assert.equal(
      shouldResumeShellTransition({
        snapshot: { bandsAlreadyExpanded: false },
        intent: { resumeShell: true },
      }),
      false,
    );
  });

  it("isLegalRoutePath", () => {
    assert.equal(isLegalRoutePath("legal/terminos"), true);
    assert.equal(isLegalRoutePath("home"), false);
  });
});
