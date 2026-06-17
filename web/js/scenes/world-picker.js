import { getLabels, setThemeId } from "../lib/theme.js";
import { navigate } from "../lib/router.js";
import { mountSceneBackground, mountWordmark } from "../components/ui.js";

export function renderWorldPicker() {
  const app = document.getElementById("app");
  if (!app) return;

  const scene = document.createElement("div");
  scene.className = "scene";
  mountSceneBackground(scene);

  const scroll = document.createElement("div");
  scroll.className = "scene-scroll scene-content";

  mountWordmark(scroll, "Elige tu aventura");

  const fantasyPanel = document.createElement("article");
  fantasyPanel.className = "panel";
  fantasyPanel.innerHTML = `
    <span class="panel__badge">Reinos Unidos</span>
    <div class="art-banner art-banner--fantasy">
      <span class="art-placeholder">PLACEHOLDER_ART</span>
      <span style="font-size:2.5rem">✦</span>
    </div>
    <p>Magia, bosques encantados y artefactos perdidos. Restaura el equilibrio del reino verde.</p>
    <button type="button" class="btn btn--primary" data-pick="fantasy">Entrar al reino</button>
  `;
  scroll.appendChild(fantasyPanel);

  const spacePanel = document.createElement("article");
  spacePanel.className = "panel";
  spacePanel.innerHTML = `
    <span class="panel__badge">Sector Alfa</span>
    <div class="art-banner art-banner--space">
      <span class="art-placeholder">PLACEHOLDER_ART</span>
      <span style="font-size:2.5rem">🚀</span>
    </div>
    <p>Naves, nebulosas y academias espaciales. Recupera el conocimiento de la galaxia azul.</p>
    <button type="button" class="btn btn--secondary" data-pick="spaceOpera">Despegar</button>
  `;
  scroll.appendChild(spacePanel);

  scroll.querySelector('[data-pick="fantasy"]')?.addEventListener("click", () => {
    setThemeId("fantasy");
    navigate("/gallery");
  });
  scroll.querySelector('[data-pick="spaceOpera"]')?.addEventListener("click", () => {
    setThemeId("spaceOpera");
    navigate("/gallery");
  });

  scene.appendChild(scroll);
  app.appendChild(scene);

  const back = document.createElement("div");
  back.className = "back-bar";
  back.innerHTML = `<button type="button" class="btn btn--ghost">← Galería</button>`;
  back.querySelector("button")?.addEventListener("click", () => navigate("/gallery"));
  scene.appendChild(back);
}
