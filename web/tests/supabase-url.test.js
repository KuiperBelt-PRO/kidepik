import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

if (!globalThis.document) {
  GlobalRegistrator.register();
}

import { resolveSupabaseUrl } from "../js/lib/supabase.js";

/**
 * @param {string} hostname
 */
function setPageHostname(hostname) {
  window.location.href = `http://${hostname}:8082/`;
}

describe("resolveSupabaseUrl", () => {
  beforeEach(() => {
    setPageHostname("localhost");
  });

  afterEach(() => {
    setPageHostname("localhost");
  });

  it("en localhost usa siempre Supabase local", () => {
    setPageHostname("localhost");
    assert.equal(
      resolveSupabaseUrl("http://localhost:54321"),
      "http://localhost:54321",
    );
  });

  it("en localhost ignora nip.io residual de LAN en config", () => {
    setPageHostname("localhost");
    assert.equal(
      resolveSupabaseUrl("http://192.168.1.75.nip.io:54321"),
      "http://localhost:54321",
    );
  });

  it("en 127.0.0.1 ignora IP privada residual en config", () => {
    setPageHostname("127.0.0.1");
    assert.equal(
      resolveSupabaseUrl("http://192.168.8.106:54321"),
      "http://localhost:54321",
    );
  });

  it("en localhost respeta URL remota cloud", () => {
    setPageHostname("localhost");
    assert.equal(
      resolveSupabaseUrl("https://abcdefgh.supabase.co"),
      "https://abcdefgh.supabase.co",
    );
  });

  it("convierte IP privada a nip.io para Google OAuth", () => {
    setPageHostname("192.168.1.75");
    assert.equal(
      resolveSupabaseUrl("http://localhost:54321"),
      "http://192.168.1.75.nip.io:54321",
    );
  });

  it("hostname nip.io se mantiene", () => {
    setPageHostname("192.168.1.75.nip.io");
    assert.equal(
      resolveSupabaseUrl("http://localhost:54321"),
      "http://192.168.1.75.nip.io:54321",
    );
  });
});
