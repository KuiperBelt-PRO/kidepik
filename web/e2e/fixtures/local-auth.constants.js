/**
 * Credenciales y URLs para auth local E2E (solo dev).
 * @module e2e/fixtures/local-auth.constants
 */

/** @type {import('../../js/config.js').config | undefined} */
let runtimeConfig;

try {
  runtimeConfig = (await import("../../js/config.js")).config;
} catch {
  runtimeConfig = undefined;
}

export const E2E_TUTOR_EMAIL =
  process.env.E2E_TUTOR_EMAIL ?? "playwright-tutor@kidepik.local";

export const E2E_TUTOR_PASSWORD =
  process.env.E2E_TUTOR_PASSWORD ?? "playwright-local-dev";

export const E2E_TUTOR_DISPLAY_NAME = "Tutor Playwright";

export const E2E_BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:8082";

export const E2E_SUPABASE_URL =
  process.env.E2E_SUPABASE_URL ?? runtimeConfig?.supabaseUrl ?? "http://localhost:54321";

export const E2E_SUPABASE_ANON_KEY =
  process.env.E2E_SUPABASE_ANON_KEY ??
  runtimeConfig?.supabaseAnonKey ??
  "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

export const E2E_AUTH_STORAGE_PATH = "e2e/.auth/tutor.json";
