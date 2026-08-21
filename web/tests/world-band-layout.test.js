import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  normalizeShellPath,
  shouldCompressWorldBands,
  worldBandsNeedTransition,
} from "../js/lib/world-band-layout.js";

describe("world-band-layout", () => {
  it("home no comprime", () => {
    assert.equal(shouldCompressWorldBands("home"), false);
    assert.equal(shouldCompressWorldBands("#/home"), false);
    assert.equal(shouldCompressWorldBands("/home"), false);
  });

  it("account y legal comprimen", () => {
    assert.equal(shouldCompressWorldBands("account"), true);
    assert.equal(shouldCompressWorldBands("member"), true);
    assert.equal(shouldCompressWorldBands("legal/terminos"), true);
    assert.equal(shouldCompressWorldBands("legal/privacidad"), true);
  });

  it("worldBandsNeedTransition detecta cambio home↔account", () => {
    assert.equal(worldBandsNeedTransition("home", "account"), true);
    assert.equal(worldBandsNeedTransition("account", "home"), true);
    assert.equal(worldBandsNeedTransition("account", "legal/terminos"), false);
    assert.equal(worldBandsNeedTransition("home", "home"), false);
  });

  it("normalizeShellPath limpia hash", () => {
    assert.equal(normalizeShellPath("#/account?x=1"), "account");
  });

  it("settings y crew comprimen (incl. subrutas)", () => {
    assert.equal(shouldCompressWorldBands("settings"), true);
    assert.equal(shouldCompressWorldBands("crew"), true);
    assert.equal(shouldCompressWorldBands("crew/new"), true);
    assert.equal(shouldCompressWorldBands("crew/abc"), true);
  });

  it("play comprime bandas (aventura en marco glass)", () => {
    assert.equal(shouldCompressWorldBands("play/abc"), true);
  });
});
