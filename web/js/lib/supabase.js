/**
 * Cliente Supabase Auth (MVP: Google OAuth).
 * @module supabase
 */

import { clearSessionAccount } from "./session-account.js";

/** @typedef {import('@supabase/supabase-js').SupabaseClient} SupabaseClient */
/** @typedef {import('@supabase/supabase-js').Session} Session */

/** @type {SupabaseClient | null} */
let client = null;

/** @type {(() => Promise<SupabaseClient>) | null} */
let clientFactory = null;

const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const OAUTH_QUERY_KEYS = ["code", "state", "error", "error_description"];
const LOCAL_SUPABASE_PORT = 54321;

/**
 * @param {string} host
 * @returns {boolean}
 */
function isPrivateIpv4Host(host) {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host || "");
  if (!match) return false;
  const a = Number(match[1]);
  const b = Number(match[2]);
  return (
    a === 10 ||
    a === 127 ||
    (a === 192 && b === 168) ||
    (a === 172 && b >= 16 && b <= 31)
  );
}

/**
 * Google OAuth rechaza redirect_uri con IP privada; nip.io resuelve al mismo host.
 * @param {string} host
 * @returns {string}
 */
function oauthFriendlyHost(host) {
  if (isPrivateIpv4Host(host)) {
    return `${host}.nip.io`;
  }
  return host;
}

/**
 * Misma máquina: localhost:54321. Dispositivo en LAN: host de la página + :54321.
 * Evita depender de config.js con IP fija (SW/cache) al probar en tablet/móvil.
 * @param {string | undefined} configured
 * @returns {string}
 */
export function resolveSupabaseUrl(configured) {
  const host = window.location.hostname;
  if (!host || host === "localhost" || host === "127.0.0.1") {
    return configured || `http://localhost:${LOCAL_SUPABASE_PORT}`;
  }
  return `http://${oauthFriendlyHost(host)}:${LOCAL_SUPABASE_PORT}`;
}

/**
 * Origen de la app para redirectTo OAuth (misma regla nip.io en LAN).
 * @returns {string}
 */
export function resolveAppOrigin() {
  const url = new URL(window.location.href);
  url.hostname = oauthFriendlyHost(url.hostname);
  return url.origin;
}

/**
 * Inyecta un factory (tests / mocks).
 * @param {(() => Promise<SupabaseClient>) | null} factory
 */
export function setSupabaseClientFactory(factory) {
  clientFactory = factory;
  client = null;
}

/**
 * @returns {Promise<SupabaseClient>}
 */
export async function getSupabaseClient() {
  if (client) return client;

  if (clientFactory) {
    client = await clientFactory();
    return client;
  }

  const { config } = await import("../config.js");
  const { createClient } = await import(/* @vite-ignore */ SUPABASE_CDN);

  const supabaseUrl = resolveSupabaseUrl(config.supabaseUrl);
  if (!supabaseUrl || !config.supabaseAnonKey) {
    throw new Error("Supabase no configurado (supabaseUrl / supabaseAnonKey)");
  }

  client = createClient(supabaseUrl, config.supabaseAnonKey, {
    auth: {
      detectSessionInUrl: true,
      persistSession: true,
      flowType: "pkce",
    },
  });
  return client;
}

/**
 * @returns {URLSearchParams}
 */
function readOAuthParams() {
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash || "";
  const qIndex = hash.indexOf("?");
  if (qIndex >= 0) {
    const hashParams = new URLSearchParams(hash.slice(qIndex + 1));
    for (const [key, value] of hashParams) {
      if (!params.has(key)) {
        params.set(key, value);
      }
    }
  }
  return params;
}

/**
 * Elimina parámetros OAuth de la URL sin recargar.
 */
export function cleanOAuthParamsFromUrl() {
  const url = new URL(window.location.href);
  for (const key of OAUTH_QUERY_KEYS) {
    url.searchParams.delete(key);
  }

  const hash = url.hash || "";
  const qIndex = hash.indexOf("?");
  if (qIndex >= 0) {
    const path = hash.slice(0, qIndex);
    const hashParams = new URLSearchParams(hash.slice(qIndex + 1));
    for (const key of OAUTH_QUERY_KEYS) {
      hashParams.delete(key);
    }
    const rest = hashParams.toString();
    url.hash = rest ? `${path}?${rest}` : path;
  }

  window.history.replaceState({}, document.title, url.toString());
}

/** Seconds before expiry when we proactively refresh (long play turns can exceed JWT lifetime). */
const SESSION_REFRESH_SKEW_SEC = 120;

/**
 * @returns {Promise<Session | null>}
 */
export async function getValidSession() {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    let session = data.session;
    if (!session?.access_token) return null;

    const nowSec = Math.floor(Date.now() / 1000);
    const expiresAt = typeof session.expires_at === "number" ? session.expires_at : 0;
    const shouldRefresh = expiresAt > 0 && expiresAt <= nowSec + SESSION_REFRESH_SKEW_SEC;
    if (shouldRefresh) {
      const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
      if (refreshError || !refreshed.session?.access_token) return null;
      session = refreshed.session;
    }

    return session;
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<{ error: Error | null }>}
 */
export async function signInWithGoogle() {
  if (!navigator.onLine) {
    return { error: new Error("offline") };
  }

  try {
    const supabase = await getSupabaseClient();
    const redirectTo = `${resolveAppOrigin()}/#/auth/callback`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    return { error: error ? new Error(error.message) : null };
  } catch (err) {
    return {
      error: err instanceof Error ? err : new Error("oauth_failed"),
    };
  }
}

/**
 * @returns {Promise<void>}
 */
export async function signOut() {
  clearSessionAccount();
  try {
    const supabase = await getSupabaseClient();
    await supabase.auth.signOut();
  } catch {
    // ignore
  }
}

/**
 * @param {(event: string, session: Session | null) => void} callback
 * @returns {Promise<{ unsubscribe: () => void }>}
 */
export async function onAuthStateChange(callback) {
  const supabase = await getSupabaseClient();
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
  return {
    unsubscribe() {
      data.subscription.unsubscribe();
    },
  };
}

/**
 * Intercambia código OAuth de la URL si existe (PKCE + hash router).
 * @returns {Promise<Session | null>}
 */
export async function exchangeCodeFromUrl() {
  try {
    const supabase = await getSupabaseClient();
    const params = readOAuthParams();
    const oauthError = params.get("error");

    if (oauthError) {
      cleanOAuthParamsFromUrl();
      return null;
    }

    const existing = await getValidSession();
    if (existing) {
      cleanOAuthParamsFromUrl();
      return existing;
    }

    const code = params.get("code");
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      cleanOAuthParamsFromUrl();
      if (error) return null;
    }

    return getValidSession();
  } catch {
    return null;
  }
}
