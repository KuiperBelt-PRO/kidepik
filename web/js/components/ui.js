/**
 * Fondo procedural SVG — PLACEHOLDER_ART hasta ilustraciones finales.
 * @param {HTMLElement} container
 */
export function mountSceneBackground(container) {
  const theme = document.documentElement.dataset.theme || "fantasy";
  const isFantasy = theme === "fantasy";

  const wrap = document.createElement("div");
  wrap.className = "scene-bg";
  wrap.innerHTML = `
    <div style="position:absolute;inset:0;background:linear-gradient(180deg,var(--color-bg-deep) 0%,var(--color-bg-mid) 45%,var(--color-bg-bottom) 100%)"></div>
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" style="position:absolute;inset:0">
      ${
        isFantasy
          ? `<path d="M0 400 Q120 360 200 390 T400 370 L430 400 L430 900 L0 900 Z" fill="rgba(8,40,24,0.88)"/>
             <path d="M0 430 Q100 400 220 420 T430 410 L430 900 L0 900 Z" fill="rgba(15,70,40,0.92)"/>`
          : Array.from({ length: 40 })
              .map(
                (_, i) =>
                  `<circle cx="${(i * 37) % 100}%" cy="${(i * 23) % 100}%" r="${1 + (i % 3)}" fill="${i % 4 === 0 ? "#fff" : "#4DA3FF"}" opacity="${0.3 + (i % 5) * 0.1}"/>`,
              )
              .join("") +
            Array.from({ length: 8 })
              .map(
                (_, i) =>
                  `<line x1="0" y1="${75 + i * 3}%" x2="100%" y2="${75 + i * 3}%" stroke="rgba(200,230,255,0.12)" stroke-width="1"/>`,
              )
              .join("")
      }
    </svg>
  `;
  container.prepend(wrap);
}

/**
 * @param {HTMLElement} parent
 */
export function mountWordmark(parent, subtitle = "") {
  const el = document.createElement("header");
  el.className = "wordmark";
  el.innerHTML = `
    <div class="wordmark__logo-wrap">
      <h1 class="wordmark__logo">KidepiK</h1>
    </div>
    ${subtitle ? `<p class="wordmark__subtitle">${subtitle}</p>` : ""}
  `;
  parent.appendChild(el);
  return el;
}

import { getThemeId, setThemeId } from "../lib/theme.js";

/**
 * @param {HTMLElement} parent
 * @param {(id: 'fantasy'|'spaceOpera') => void} [onChange]
 */
export function mountThemeToggle(parent, onChange) {
  const wrap = document.createElement("div");
  wrap.className = "theme-toggle";
  const current = getThemeId();

  const mkBtn = (id, label) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `theme-toggle__btn${current === id ? " is-active" : ""}`;
    btn.textContent = label;
    btn.addEventListener("click", () => {
      setThemeId(id);
      wrap.querySelectorAll(".theme-toggle__btn").forEach((b) => {
        b.classList.toggle("is-active", b === btn);
      });
      onChange?.(id);
      window.location.reload();
    });
    return btn;
  };

  wrap.appendChild(mkBtn("fantasy", "Fantasía"));
  wrap.appendChild(mkBtn("spaceOpera", "Espacio"));
  parent.appendChild(wrap);
}
