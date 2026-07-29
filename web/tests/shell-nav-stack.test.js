import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";

import {
  canShellNavBack,
  canShellNavForward,
  getShellNavState,
  inferShellNavParent,
  onShellPathChange,
  resetShellNavStack,
  SHELL_NAV_STACK_MAX,
  shellNavBack,
  shellNavForward,
} from "../js/lib/shell-nav-stack.js";

describe("shell-nav-stack", () => {
  beforeEach(async () => {
    const mod = await import("../js/lib/shell-nav-stack.js");
    mod.setShellNavDispatch(null);
    mod.setShellNavShellRoute(null);
    resetShellNavStack("home");
  });

  it("registra avance en la pila atrás", () => {
    onShellPathChange("home", "crew");
    assert.equal(getShellNavState().current, "crew");
    assert.ok(canShellNavBack());
    assert.equal(getShellNavState().backDepth, 1);
    assert.equal(!canShellNavForward(), true);
  });

  it("atrás restaura la ruta anterior", async () => {
    onShellPathChange("home", "crew");
    onShellPathChange("crew", "crew/abc");
    assert.equal(getShellNavState().current, "crew/abc");

    await shellNavBack();
    onShellPathChange("crew/abc", "crew");
    assert.equal(getShellNavState().current, "crew");
    assert.ok(canShellNavForward());
  });

  it("adelante restaura tras atrás", async () => {
    onShellPathChange("home", "crew");
    onShellPathChange("crew", "settings");
    await shellNavBack();
    onShellPathChange("settings", "crew");
    await shellNavForward();
    onShellPathChange("crew", "settings");
    assert.equal(getShellNavState().current, "settings");
  });

  it("limita la pila atrás", () => {
    let from = "home";
    for (let i = 0; i < SHELL_NAV_STACK_MAX + 4; i++) {
      const to = `step-${i}`;
      onShellPathChange(from, to);
      from = to;
    }
    assert.equal(getShellNavState().backDepth, SHELL_NAV_STACK_MAX);
  });

  it("semilla padre en acceso directo", () => {
    resetShellNavStack("loader", { fresh: true });
    onShellPathChange("loader", "crew/abc-id");
    assert.ok(canShellNavBack());
    assert.equal(inferShellNavParent("crew/abc-id"), "crew");
  });

  it("inferShellNavParent para secciones shell", () => {
    assert.equal(inferShellNavParent("crew"), "home");
    assert.equal(inferShellNavParent("crew/new"), "crew");
    assert.equal(inferShellNavParent("settings"), "home");
    assert.equal(inferShellNavParent("home"), null);
  });

  it("dispatch local no usa hash", async () => {
    const seen = [];
    resetShellNavStack("demo");
    const { setShellNavDispatch } = await import("../js/lib/shell-nav-stack.js");
    setShellNavDispatch(async (path) => {
      seen.push(path);
    });

    onShellPathChange("demo", "demo/controls");
    await shellNavBack();
    assert.deepEqual(seen, ["demo"]);
    assert.equal(getShellNavState().current, "demo");
  });
});
