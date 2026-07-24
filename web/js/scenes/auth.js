/**
 * Escena auth standalone (deep-link / sesión caducada).
 * @module scenes/auth
 */

import { mountAuthPanel } from "../components/auth-panel.js";
import { assetUrl } from "../lib/assets.manifest.js";
import { GATE_COPY } from "../components/loader-gate-constants.js";
import { bindLegalLinkTransitions } from "./legal.js";

/**
 * @returns {{ destroy: () => void }}
 */
export function renderAuth() {
  const app = document.getElementById("app");
  if (!app) return { destroy() {} };

  const scene = document.createElement("div");
  scene.className = "scene scene-auth";

  const bg = document.createElement("div");
  bg.className = "scene-auth__bg";
  const bgSrc = assetUrl("loader.bg.plain");
  if (bgSrc) {
    bg.style.backgroundImage = `url(${bgSrc})`;
  }

  const chrome = document.createElement("div");
  chrome.className = "scene-auth__chrome";

  const brand = document.createElement("div");
  brand.className = "loader-auth-brand is-static";

  const logoWrap = document.createElement("div");
  logoWrap.className = "loader-logo-wrap is-auth-positioned is-ready";

  const logoSrc = assetUrl("loader.logo");
  if (logoSrc) {
    const img = document.createElement("img");
    img.className = "loader-logo";
    img.alt = "KidepiK";
    img.src = logoSrc;
    logoWrap.appendChild(img);
  } else {
    const fallback = document.createElement("p");
    fallback.className = "loader-logo-fallback";
    fallback.textContent = "KidepiK";
    logoWrap.appendChild(fallback);
  }

  const slogan = document.createElement("div");
  slogan.className = "loader-auth-slogan is-visible";

  const line1 = document.createElement("p");
  line1.className = "loader-auth-slogan__line loader-auth-slogan__line--sci";
  line1.textContent = GATE_COPY.sloganLine1;

  const line2 = document.createElement("p");
  line2.className = "loader-auth-slogan__line loader-auth-slogan__line--fantasy";
  line2.textContent = GATE_COPY.sloganLine2;

  slogan.append(line1, line2);
  brand.append(logoWrap, slogan);
  chrome.appendChild(brand);

  const panel = mountAuthPanel(chrome, { embedded: false });
  bindLegalLinkTransitions(panel.root);
  scene.append(bg, chrome);
  app.appendChild(scene);

  return {
    destroy() {
      panel.destroy();
      scene.remove();
    },
  };
}
