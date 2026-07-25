/**
 * Cliente Supabase Auth (MVP: Google OAuth).
 * @module supabase
 */

/** @typedef {import('@supabase/supabase-js').SupabaseClient} SupabaseClient */
/** @typedef {import('@supabase/supabase-js').Session} Session */

/** @type {SupabaseClient | null} */
let client = null;

/** @type {(() => Promise<SupabaseClient>) | null} */
let clientFactory = null;

const SUPABASE_CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
const OAUTH_QUERY_KEYS = ["code", "state", "error", "error_description"];

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

  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    throw new Error("Supabase no configurado (supabaseUrl / supabaseAnonKey)");
  }

  client = createClient(config.supabaseUrl, config.supabaseAnonKey, {
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

/**
 * @returns {Promise<Session | null>}
 */
export async function getValidSession() {
  try {
    const supabase = await getSupabaseClient();
    const { data, error } = await supabase.auth.getSession();
    if (error) return null;
    const session = data.session;
    if (!session?.access_token) return null;
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
    const redirectTo = `${window.location.origin}/#/auth/callback`;
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
