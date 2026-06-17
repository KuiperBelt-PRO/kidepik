import { navigate } from "../lib/router.js";
import { getLabels, getLoaderPhrases } from "../lib/theme.js";
import { mountSceneBackground, mountWordmark } from "../components/ui.js";

const DURATION_MS = 2500;

export function renderLoader() {
  const app = document.getElementById("app");
  if (!app) return;

  const scene = document.createElement("div");
  scene.className = "scene";
  mountSceneBackground(scene);

  const content = document.createElement("div");
  content.className = "scene-content";
  content.style.cssText =
    "flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;min-height:100dvh;cursor:pointer;";

  mountWordmark(content, getLabels().worldName);

  const ring = document.createElement("div");
  ring.className = "loader-ring";
  content.appendChild(ring);

  const phrase = document.createElement("p");
  phrase.className = "loader-phrase";
  const phrases = getLoaderPhrases();
  let idx = 0;
  phrase.textContent = phrases[0];
  content.appendChild(phrase);

  const tap = document.createElement("p");
  tap.className = "loader-tap";
  tap.textContent = "Toca para saltar";
  content.appendChild(tap);

  scene.appendChild(content);
  app.appendChild(scene);

  const phraseTimer = setInterval(() => {
    idx = (idx + 1) % phrases.length;
    phrase.textContent = phrases[idx];
  }, 1200);

  const goGallery = () => {
    clearInterval(phraseTimer);
    clearTimeout(doneTimer);
    navigate("/gallery");
  };

  content.addEventListener("click", goGallery);
  const doneTimer = setTimeout(goGallery, DURATION_MS);
}
