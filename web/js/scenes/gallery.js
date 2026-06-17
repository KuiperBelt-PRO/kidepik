import { MOCKUP_CATALOG } from "../data/catalog.js";
import { navigate } from "../lib/router.js";
import { getLabels } from "../lib/theme.js";
import {
  mountSceneBackground,
  mountThemeToggle,
  mountWordmark,
} from "../components/ui.js";

export function renderGallery() {
  const app = document.getElementById("app");
  if (!app) return;

  const scene = document.createElement("div");
  scene.className = "scene";
  mountSceneBackground(scene);

  const scroll = document.createElement("div");
  scroll.className = "scene-scroll scene-content";

  mountWordmark(scroll, "Galería de diseño");
  mountThemeToggle(scroll);

  const hint = document.createElement("p");
  hint.style.textAlign = "center";
  hint.style.color = "var(--color-secondary)";
  hint.style.marginBottom = "var(--space-lg)";
  hint.textContent = `Tema: ${getLabels().worldName} — cambia arriba para validar el look.`;
  scroll.appendChild(hint);

  const featured = document.createElement("a");
  featured.className = "card-link";
  featured.href = "#/world-picker";
  featured.innerHTML = `
    <article class="card card--featured">
      <h2 class="card__title">Selector de mundo</h2>
      <p class="card__desc">Pantalla completa de onboarding visual</p>
    </article>
  `;
  scroll.appendChild(featured);

  for (const item of MOCKUP_CATALOG.filter((m) => m.id !== "worldPicker")) {
    const link = document.createElement("a");
    link.className = "card-link";
    link.href = `#/mockup/${item.id}`;
    link.innerHTML = `
      <article class="card">
        <h2 class="card__title">${item.title}</h2>
        <p class="card__desc">${item.description}</p>
      </article>
    `;
    scroll.appendChild(link);
  }

  const pocBtn = document.createElement("button");
  pocBtn.type = "button";
  pocBtn.className = "btn btn--ghost";
  pocBtn.style.marginTop = "var(--space-lg)";
  pocBtn.textContent = "POC arquitectura (dev)";
  pocBtn.addEventListener("click", () => navigate("/poc"));
  scroll.appendChild(pocBtn);

  scene.appendChild(scroll);
  app.appendChild(scene);
}
