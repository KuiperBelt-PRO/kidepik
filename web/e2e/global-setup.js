/**
 * Playwright global setup: asegura usuario tutor y storageState.
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { E2E_AUTH_STORAGE_PATH } from "./fixtures/local-auth.constants.js";

const webRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const storagePath = join(webRoot, E2E_AUTH_STORAGE_PATH);

export default async function globalSetup() {
  if (existsSync(storagePath)) return;

  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["e2e/helpers/ensure-tutor-user.mjs"], {
      cwd: webRoot,
      stdio: "inherit",
      env: process.env,
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) resolve(undefined);
      else reject(new Error(`ensure-tutor-user exited with ${code}`));
    });
  });
}
