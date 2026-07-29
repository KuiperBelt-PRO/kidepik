/**
 * Transición animada de bandas al cambiar de ruta shell.
 * @module shell-navigation
 */

import { hashRoutePath, navigate } from "./router.js";
import {
  normalizeShellPath,
  shouldCompressWorldBands,
  worldBandsNeedTransition,
} from "./world-band-layout.js";
import { prepareWorldTransition } from "./world-transition.js";
import { captureShellNavigationSnapshot } from "./shell-section-transition.js";
import { isLegalRoutePath, navigateFromLegal } from "./legal-navigation.js";
import { setShellNavShellRoute } from "./shell-nav-stack.js";

/**
 * @param {string} path
 */
export async function navigateShellRoute(path) {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  const toPath = normalizeShellPath(normalized);
  const fromPath = hashRoutePath();

  if (isLegalRoutePath(fromPath)) {
    await navigateFromLegal(normalized);
    return;
  }

  const bandTransition = worldBandsNeedTransition(fromPath, toPath);
  if (bandTransition || fromPath !== toPath) {
    prepareWorldTransition(captureShellNavigationSnapshot(fromPath), {
      to: toPath,
      bandTransition,
    });
  }

  navigate(normalized);
}

setShellNavShellRoute(navigateShellRoute);
