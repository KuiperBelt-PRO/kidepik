/**
 * Callback OAuth: espera sesión y navega a home.
 * @module scenes/auth-callback
 */

import { navigate } from "../lib/router.js";
import { exchangeCodeFromUrl, getValidSession } from "../lib/supabase.js";

/**
 * @returns {{ destroy: () => void }}
 */
export function renderAuthCallback() {
  const app = document.getElementById("app");
  if (!app) return { destroy() {} };

  const scene = document.createElement("div");
  scene.className = "scene scene-auth-callback";
  scene.innerHTML = `<p class="scene-auth-callback__msg">Completando acceso…</p>`;
  app.appendChild(scene);

  let cancelled = false;

  void (async () => {
    await exchangeCodeFromUrl();
    const session = await getValidSession();
    if (cancelled) return;
    if (session) {
      navigate("/home");
    } else {
      navigate("/auth");
    }
  })();

  return {
    destroy() {
      cancelled = true;
      scene.remove();
    },
  };
}
