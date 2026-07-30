/**
 * Auth local para Playwright (GoTrue password + bootstrap API).
 * @module e2e/helpers/local-auth
 */

import {
  E2E_BASE_URL,
  E2E_SUPABASE_ANON_KEY,
  E2E_SUPABASE_URL,
  E2E_TUTOR_DISPLAY_NAME,
  E2E_TUTOR_EMAIL,
  E2E_TUTOR_PASSWORD,
} from "../fixtures/local-auth.constants.js";

/**
 * @typedef {object} GoTrueSession
 * @property {string} access_token
 * @property {string} refresh_token
 * @property {number} expires_in
 * @property {string} token_type
 */

/**
 * @param {string} path
 * @param {RequestInit} [init]
 */
async function goTrueFetch(path, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("apikey", E2E_SUPABASE_ANON_KEY);
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${E2E_SUPABASE_URL}${path}`, { ...init, headers });
  /** @type {unknown} */
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { res, body };
}

/**
 * @returns {Promise<GoTrueSession>}
 */
export async function signInTestTutor() {
  const { res, body } = await goTrueFetch("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({
      email: E2E_TUTOR_EMAIL,
      password: E2E_TUTOR_PASSWORD,
    }),
  });
  if (!res.ok) {
    const msg =
      body && typeof body === "object" && "error_description" in body
        ? String(/** @type {{ error_description?: string }} */ (body).error_description)
        : `signIn failed (${res.status})`;
    throw new Error(msg);
  }
  if (!body || typeof body !== "object" || !("access_token" in body)) {
    throw new Error("signIn: respuesta sin access_token");
  }
  return /** @type {GoTrueSession} */ (body);
}

/**
 * @returns {Promise<void>}
 */
export async function signUpTestTutor() {
  const { res, body } = await goTrueFetch("/auth/v1/signup", {
    method: "POST",
    body: JSON.stringify({
      email: E2E_TUTOR_EMAIL,
      password: E2E_TUTOR_PASSWORD,
      data: { full_name: E2E_TUTOR_DISPLAY_NAME },
    }),
  });
  if (res.ok) return;
  const msg =
    body && typeof body === "object" && "msg" in body
      ? String(/** @type {{ msg?: string }} */ (body).msg)
      : `signUp failed (${res.status})`;
  if (/already|registered|exists/i.test(msg)) return;
  throw new Error(msg);
}

/**
 * @returns {Promise<GoTrueSession>}
 */
export async function ensureTestTutorSession() {
  try {
    return await signInTestTutor();
  } catch {
    await signUpTestTutor();
    return signInTestTutor();
  }
}

/**
 * @param {string} accessToken
 */
export async function bootstrapParentAccount(accessToken) {
  const res = await fetch(`${E2E_BASE_URL}/api/v1/parents/bootstrap`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  if (!res.ok && res.status !== 409) {
    const text = await res.text();
    throw new Error(`bootstrap failed (${res.status}): ${text}`);
  }
}

/**
 * @param {import('@playwright/test').Page} page
 * @param {GoTrueSession} session
 */
export async function injectSupabaseSession(page, session) {
  await page.goto(E2E_BASE_URL, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.evaluate(
    async ({ supabaseUrl, anonKey, accessToken, refreshToken }) => {
      const { createClient } = await import(
        "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm"
      );
      const client = createClient(supabaseUrl, anonKey, {
        auth: { persistSession: true, detectSessionInUrl: false, flowType: "pkce" },
      });
      const { error } = await client.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      if (error) throw new Error(error.message);
    },
    {
      supabaseUrl: E2E_SUPABASE_URL,
      anonKey: E2E_SUPABASE_ANON_KEY,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
    },
  );
}

/**
 * Sesión GoTrue + bootstrap + inyección en el navegador Playwright.
 * @param {import('@playwright/test').Page} page
 * @param {{ targetRoute?: string }} [opts] hash route sin #, p. ej. `crew` o `crew/uuid`
 */
export async function authenticatePlaywrightPage(page, opts = {}) {
  const targetRoute = opts.targetRoute ?? "home";
  const session = await ensureTestTutorSession();
  await bootstrapParentAccount(session.access_token);
  await injectSupabaseSession(page, session);
  const hash = targetRoute.startsWith("#") ? targetRoute : `#/${targetRoute.replace(/^\//, "")}`;
  await page.goto(`${E2E_BASE_URL}/${hash}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForTimeout(800);
  return session;
}
