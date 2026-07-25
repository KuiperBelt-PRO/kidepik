/**
 * Panel de bienvenida post-login (estilo hint del loader).
 * @module home-welcome-panel
 */

/**
 * @param {HTMLElement} container
 * @param {{ displayName: string; onSignOut: () => void | Promise<void> }} options
 * @returns {{ destroy: () => void }}
 */
export function mountHomeWelcomePanel(container, { displayName, onSignOut }) {
  const welcome = document.createElement("div");
  welcome.className = "loader-home-welcome";
  welcome.setAttribute("aria-live", "polite");

  const lineSci = document.createElement("p");
  lineSci.className = "loader-home-welcome__sci";
  lineSci.textContent = `Hola, ${displayName},`;

  const lineFantasy = document.createElement("p");
  lineFantasy.className = "loader-home-welcome__fantasy";
  lineFantasy.textContent = "bienvenido a tu viaje épico";

  welcome.append(lineSci, lineFantasy);

  const signOutBtn = document.createElement("button");
  signOutBtn.type = "button";
  signOutBtn.className = "home-welcome-signout";
  signOutBtn.textContent = "Cerrar sesión (temporal)";

  function onClick() {
    void Promise.resolve(onSignOut());
  }

  signOutBtn.addEventListener("click", onClick);
  container.append(welcome, signOutBtn);

  return {
    destroy() {
      signOutBtn.removeEventListener("click", onClick);
      welcome.remove();
      signOutBtn.remove();
    },
  };
}

/**
 * @param {import('@supabase/supabase-js').Session} session
 * @returns {string}
 */
export function resolveDisplayName(session) {
  const meta = session.user?.user_metadata;
  if (meta && typeof meta === "object") {
    if (typeof meta.full_name === "string" && meta.full_name.trim()) {
      return meta.full_name.trim();
    }
    if (typeof meta.name === "string" && meta.name.trim()) {
      return meta.name.trim();
    }
  }
  const email = session.user?.email;
  if (typeof email === "string" && email.includes("@")) {
    return email.split("@")[0];
  }
  return "explorador";
}
