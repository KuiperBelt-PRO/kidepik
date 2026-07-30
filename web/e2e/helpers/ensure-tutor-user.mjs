#!/usr/bin/env node
/**
 * Genera storageState Playwright para el tutor de prueba.
 * Uso: node e2e/helpers/ensure-tutor-user.mjs
 */

import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { E2E_AUTH_STORAGE_PATH } from "../fixtures/local-auth.constants.js";
import { authenticatePlaywrightPage } from "./local-auth.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const webRoot = join(__dirname, "..", "..");
const storagePath = join(webRoot, E2E_AUTH_STORAGE_PATH);

async function main() {
  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();

  try {
    await authenticatePlaywrightPage(page, { targetRoute: "crew" });
    await mkdir(dirname(storagePath), { recursive: true });
    await context.storageState({ path: storagePath });
    console.log(`OK: storageState → ${E2E_AUTH_STORAGE_PATH}`);
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
