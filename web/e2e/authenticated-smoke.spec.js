import { test, expect } from "@playwright/test";
import { E2E_AUTH_STORAGE_PATH } from "./fixtures/local-auth.constants.js";

test.describe("humo autenticado (storageState)", () => {
  test.use({ storageState: E2E_AUTH_STORAGE_PATH });

  test("tripulación carga con sesión", async ({ page }) => {
    await page.goto("/#/crew");
    await expect(page.getByRole("heading", { name: "Tripulación" })).toBeVisible({
      timeout: 15000,
    });
    await expect(page.getByText("Tripulantes a tu cargo")).toBeVisible();
  });
});
