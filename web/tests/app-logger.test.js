import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach, mock } from "node:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

if (!globalThis.document) {
  GlobalRegistrator.register();
}

describe("app-logger", () => {
  beforeEach(() => {
    sessionStorage.clear();
    mock.restoreAll();
  });

  afterEach(() => {
    mock.restoreAll();
  });

  it("queues events when client_logging enabled", async () => {
    mock.method(globalThis, "fetch", async (url) => {
      if (String(url).includes("architecture/config")) {
        return {
          ok: true,
          json: async () => ({ client_logging: true, client_log_level: "info" }),
        };
      }
      return { ok: true, json: async () => ({ accepted: 1 }) };
    });

    const { initAppLogger, appLog, flush } = await import("../js/lib/app-logger.js");
    await initAppLogger();
    appLog("info", "test_event", { foo: "bar" });
    await flush(false);

    const calls = globalThis.fetch.mock.calls;
    const ingest = calls.find((c) => String(c.arguments[0]).includes("client/logs"));
    assert.ok(ingest);
    const body = JSON.parse(String(ingest.arguments[1]?.body));
    assert.equal(body.events.length, 1);
    assert.equal(body.events[0].message, "test_event");
  });

  it("redacts sensitive context keys", async () => {
    mock.method(globalThis, "fetch", async (url) => {
      if (String(url).includes("architecture/config")) {
        return {
          ok: true,
          json: async () => ({ client_logging: true, client_log_level: "info" }),
        };
      }
      return { ok: true, json: async () => ({ accepted: 1 }) };
    });

    const { initAppLogger, appLog, flush } = await import("../js/lib/app-logger.js");
    await initAppLogger();
    appLog("warning", "auth_fail", { authorization: "Bearer secret" });
    await flush(false);

    const calls = globalThis.fetch.mock.calls;
    const ingest = calls.find((c) => String(c.arguments[0]).includes("client/logs"));
    const body = JSON.parse(String(ingest.arguments[1]?.body));
    assert.equal(body.events[0].context.authorization, "[redacted]");
  });

  it("skips when client_logging disabled", async () => {
    mock.method(globalThis, "fetch", async (url) => {
      if (String(url).includes("architecture/config")) {
        return {
          ok: true,
          json: async () => ({ client_logging: false, client_log_level: "info" }),
        };
      }
      return { ok: true, json: async () => ({}) };
    });

    const { initAppLogger, appLog, flush } = await import("../js/lib/app-logger.js");
    await initAppLogger();
    appLog("info", "ignored");
    await flush(false);

    const ingest = globalThis.fetch.mock.calls.find((c) =>
      String(c.arguments[0]).includes("client/logs"),
    );
    assert.equal(ingest, undefined);
  });
});
