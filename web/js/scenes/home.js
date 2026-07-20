/**
 * Home placeholder post-login (hasta onboarding).
 * @module scenes/home
 */

import { navigate } from "../lib/router.js";
import { getValidSession, signOut } from "../lib/supabase.js";

/**
 * @returns {{ destroy: () => void }}
 */
export function renderHome() {
  const app = document.getElementById("app");
  if (!app) return { destroy() {} };

  const scene = document.createElement("div");
  scene.className = "scene scene-home";

  const card = document.createElement("div");
  card.className = "scene-home__card";

  const title = document.createElement("h1");
  title.className = "scene-home__title";
  title.textContent = "Bienvenido";

  const emailEl = document.createElement("p");
  emailEl.className = "scene-home__email";
  emailEl.textContent = "Cargando sesión…";

  const note = document.createElement("p");
  note.className = "scene-home__note";
  note.textContent = "Placeholder hasta el onboarding (selector de mundo).";

  const signOutBtn = document.createElement("button");
  signOutBtn.type = "button";
  signOutBtn.className = "scene-home__signout";
  signOutBtn.textContent = "Cerrar sesión";

  card.append(title, emailEl, note, signOutBtn);
  scene.appendChild(card);
  app.appendChild(scene);

  let cancelled = false;

  void (async () => {
    const session = await getValidSession();
    if (cancelled) return;
    if (!session) {
      navigate("/loader");
      return;
    }
    const email = session.user?.email || "explorador";
    emailEl.textContent = email;
    title.textContent = `Bienvenido, ${email}`;
  })();

  async function onSignOut() {
    await signOut();
    navigate("/loader");
  }

  function onSignOutClick() {
    void onSignOut();
  }

  signOutBtn.addEventListener("click", onSignOutClick);

  return {
    destroy() {
      cancelled = true;
      signOutBtn.removeEventListener("click", onSignOutClick);
      scene.remove();
    },
  };
}
