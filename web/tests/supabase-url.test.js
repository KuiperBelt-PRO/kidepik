import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

if (!globalThis.document) {
  GlobalRegistrator.register();
}

import { resolveSupabaseUrl } from "../js/lib/supabase.js";

describe("resolveSupabaseUrl", () => {
  let originalHostname;

  beforeEach(() => {
    originalHostname = window.location.hostname;
  });

  afterEach(() => {
    window.location.hostname = originalHostname;
  });

  it("usa config en localhost", () => {
    window.location.hostname = "localhost";
    assert.equal(
      resolveSupabaseUrl("http://localhost:54321"),
      "http://localhost:54321",
    );
  });

  it("convierte IP privada a nip.io para Google OAuth", () => {
    window.location.hostname = "192.168.1.75";
    assert.equal(
      resolveSupabaseUrl("http://localhost:54321"),
      "http://192.168.1.75.nip.io:54321",
    );
  });

  it("hostname nip.io se mantiene", () => {
    window.location.hostname = "192.168.1.75.nip.io";
    assert.equal(
      resolveSupabaseUrl("http://localhost:54321"),
      "http://192.168.1.75.nip.io:54321",
    );
  });
});
