import { getLabels } from "../lib/theme.js";
import { navigate } from "../lib/router.js";
import { mountSceneBackground } from "../components/ui.js";

/** @param {string} id */
export function renderMockup(id) {
  const app = document.getElementById("app");
  if (!app) return;

  const scene = document.createElement("div");
  scene.className = "scene";
  mountSceneBackground(scene);

  const scroll = document.createElement("div");
  scroll.className = "scene-scroll scene-content";

  const labels = getLabels();
  let inner = "";

  switch (id) {
    case "dialogue":
      inner = `
        <article class="panel">
          <div class="dialogue-row">
            <div class="dialogue-portrait"><div class="dialogue-portrait__inner">🧙</div></div>
            <div>
              <p style="color:var(--color-primary);font-family:var(--font-display);margin:0 0 8px">Guía del bosque</p>
              <p style="margin:0;line-height:1.5">Las runas del sendero brillan cuando escuchas con atención. ¿Estás listo para el primer reto?</p>
            </div>
          </div>
          <button type="button" class="btn btn--primary" style="margin-top:16px">${labels.continueLabel}</button>
        </article>`;
      break;
    case "choice":
      inner = `
        <div class="panel">
          <p style="text-align:center;font-family:var(--font-display);margin-bottom:12px">¿Qué camino eliges?</p>
          <button type="button" class="btn btn--primary" style="margin-bottom:8px">Seguir el sendero luminoso</button>
          <button type="button" class="btn btn--ghost" style="margin-bottom:8px">Explorar la cueva antigua</button>
          <button type="button" class="btn btn--ghost">Preguntar al sabio del pueblo</button>
        </div>`;
      break;
    case "challenge":
      inner = `
        <article class="panel">
          <span class="panel__badge">Reto</span>
          <p>Si tienes 3 cristales y encuentras 2 más, ¿cuántos llevas en tu mochila?</p>
          <button type="button" class="btn btn--primary" style="margin-bottom:8px">4</button>
          <button type="button" class="btn btn--secondary" style="margin-bottom:8px">5</button>
          <button type="button" class="btn btn--primary" style="margin-bottom:8px">6</button>
          <button type="button" class="btn btn--secondary" style="margin-bottom:8px">7</button>
          <div style="margin-top:12px;padding:12px;background:var(--color-frame-fill);border-radius:8px">
            <strong style="color:var(--color-hint)">${labels.hintLabel}</strong>
            <p style="margin:4px 0 0;color:var(--color-on-surface-muted)">Suma los cristales que ya tenías con los nuevos.</p>
          </div>
        </article>`;
      break;
    case "map":
      inner = `
        <div class="map-row">
          <div class="map-node is-active"><div class="map-node__circle">◆</div><span>Bosque</span></div>
          <div class="map-node"><div class="map-node__circle">◇</div><span>Torre</span></div>
          <div class="map-node is-locked"><div class="map-node__circle">○</div><span>Cueva</span></div>
        </div>`;
      break;
    case "hud":
      inner = `
        <article class="panel" style="background:var(--color-overlay);color:var(--color-secondary);border-color:var(--color-primary)">
          <p style="margin:0 0 4px;font-family:var(--font-display)">Matemáticas</p>
          <p style="margin:0 0 12px;opacity:0.85">Bosque de los Números</p>
          <div style="height:8px;background:rgba(255,255,255,0.15);border-radius:4px;overflow:hidden">
            <div style="width:62%;height:100%;background:linear-gradient(90deg,var(--color-primary),var(--color-secondary))"></div>
          </div>
          <p style="margin:8px 0 0;font-size:0.85rem">62% — ${labels.progressUnit}</p>
        </article>`;
      break;
    case "reward":
      inner = `
        <div class="reward-slot">
          <span style="font-size:2rem">★</span>
          <div>
            <strong style="font-family:var(--font-display)">Cristal de memoria</strong>
            <p style="margin:4px 0 0;opacity:0.9">Brilla cuando recuerdas una lección. +1 al hilo narrativo.</p>
          </div>
        </div>`;
      break;
    case "minigame":
      inner = `
        <div class="minigame-shell">
          <strong style="font-family:var(--font-display);color:var(--color-secondary)">Atrapa luciérnagas</strong>
          <div class="minigame-shell__canvas">Zona de juego táctil (PixiJS — fase posterior)</div>
        </div>`;
      break;
    default:
      inner = `<p>Mockup desconocido: ${id}</p>`;
  }

  scroll.innerHTML = inner;
  scene.appendChild(scroll);
  app.appendChild(scene);

  const back = document.createElement("div");
  back.className = "back-bar";
  back.innerHTML = `<button type="button" class="btn btn--ghost">← Galería</button>`;
  back.querySelector("button")?.addEventListener("click", () => navigate("/gallery"));
  scene.appendChild(back);
}
