/**
 * Panel de bienvenida post-login (estilo hint del loader).
 * @module home-welcome-panel
 */

/**
 * @param {HTMLElement} container
 * @param {{
 *   displayName: string;
 *   lineSci?: string;
 *   lineFantasy?: string;
 *   onSignOut?: () => void | Promise<void>;
 * }} options
 * @returns {{ destroy: () => void }}
 */
export function mountHomeWelcomePanel(container, { displayName, lineSci, lineFantasy, onSignOut }) {
  const welcome = document.createElement("div");
  welcome.className = "loader-home-welcome";
  welcome.setAttribute("aria-live", "polite");

  const sci = document.createElement("p");
  sci.className = "loader-home-welcome__sci";
  sci.textContent = lineSci ?? `Hola, ${displayName},`;

  const fantasy = document.createElement("p");
  fantasy.className = "loader-home-welcome__fantasy";
  fantasy.textContent = lineFantasy ?? "bienvenido a tu viaje épico";

  welcome.append(sci, fantasy);
  container.append(welcome);

  /** @type {HTMLButtonElement | null} */
  let signOutBtn = null;
  /** @type {(() => void) | null} */
  let onClick = null;

  if (typeof onSignOut === "function") {
    signOutBtn = document.createElement("button");
    signOutBtn.type = "button";
    signOutBtn.className = "home-welcome-signout";
    signOutBtn.textContent = "Cerrar sesión (temporal)";
    onClick = () => {
      void Promise.resolve(onSignOut());
    };
    signOutBtn.addEventListener("click", onClick);
    container.append(signOutBtn);
  }

  return {
    destroy() {
      if (signOutBtn && onClick) {
        signOutBtn.removeEventListener("click", onClick);
        signOutBtn.remove();
      }
      welcome.remove();
    },
    /**
     * @param {string} name
     */
    updateDisplayName(name) {
      sci.textContent = lineSci ?? `Hola, ${name},`;
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
