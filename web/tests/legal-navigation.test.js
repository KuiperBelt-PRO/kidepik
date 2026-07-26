import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  isLegalRoutePath,
  legalTransitionSourceFromPath,
  resolveLegalBackNavigation,
  shouldAnimateLegalEntry,
  shouldResumeShellTransition,
} from "../js/lib/legal-navigation.js";

describe("legal-navigation", () => {
  it("con sesión vuelve a home sin handoff auth", () => {
    const target = resolveLegalBackNavigation(true);
    assert.equal(target.mode, "authenticated-home");
    assert.equal(target.path, "/home");
  });

  it("sin sesión mantiene handoff al loader", () => {
    const target = resolveLegalBackNavigation(false);
    assert.equal(target.mode, "auth-handoff");
    assert.equal(target.path, "/loader");
  });

  it("shouldAnimateLegalEntry con snapshot e intent legal", () => {
    assert.equal(
      shouldAnimateLegalEntry({
        snapshot: { logo: { left: 0, top: 0, width: 10, height: 10 }, from: "home" },
        intent: { to: "legal", from: "home" },
      }),
      true,
    );
    assert.equal(
      shouldAnimateLegalEntry({ snapshot: null, intent: { to: "legal", from: "home" } }),
      false,
    );
  });

  it("shouldResumeShellTransition tras salida autenticada de legal", () => {
    assert.equal(
      shouldResumeShellTransition({
        snapshot: { bandsAlreadyExpanded: true, from: "legal" },
        intent: { resumeShell: true, to: "home", from: "legal" },
      }),
      true,
    );
    assert.equal(
      shouldResumeShellTransition({ snapshot: null, intent: { resumeShell: true } }),
      false,
    );
  });

  it("legalTransitionSourceFromPath e isLegalRoutePath", () => {
    assert.equal(legalTransitionSourceFromPath("home"), "home");
    assert.equal(legalTransitionSourceFromPath("#/account"), "account");
    assert.equal(isLegalRoutePath("legal/terminos"), true);
    assert.equal(isLegalRoutePath("home"), false);
  });
});
