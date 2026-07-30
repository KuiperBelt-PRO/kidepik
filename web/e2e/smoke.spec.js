import { test, expect } from "@playwright/test";

/**
 * Humo E2E contra stack Docker (:8082).
 * UI profunda (loader, shell) → MCP Playwright manual según SPEC_DEV_TEST_CI.
 */
test.describe("humo stack POC", () => {
  test("health API", async ({ request }) => {
    const res = await request.get("/api/v1/health");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  test("legal términos API", async ({ request }) => {
    const res = await request.get("/api/v1/legal/terminos");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.title).toBeTruthy();
    expect(String(body.body_markdown).length).toBeGreaterThan(10);
  });

  test("legal privacidad API", async ({ request }) => {
    const res = await request.get("/api/v1/legal/privacidad");
    expect(res.ok()).toBeTruthy();
  });

  test("architecture status", async ({ request }) => {
    const res = await request.get("/api/v1/architecture/status");
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.api.ok).toBe(true);
  });
});
