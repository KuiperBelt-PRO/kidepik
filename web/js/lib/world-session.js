/**
 * Sesión persistente de capas del mundo (fantasía + espacio) entre loader/auth y legal.
 * @module world-session
 */

/** @typedef {{
 *   layers: HTMLDivElement;
 *   ownerScene: HTMLElement | null;
 *   teardownLogoMaskSync: () => void;
 *   spaceOrbitTeardown: { destroy: () => void; relayout?: () => void } | null;
 *   meteorTeardown: { destroy: () => void } | null;
 *   fantasyBackdropTeardown: { destroy: () => void } | null;
 *   fantasyTerrainTeardown: { destroy: () => void } | null;
 *   fantasyCloudsTeardown: { destroy: () => void } | null;
 *   fantasyCelestialTeardown: { destroy: () => void } | null;
 *   fantasySceneTeardown: { destroy: () => void; relayout?: () => void } | null;
 *   fantasyLayersMounted: boolean;
 *   spaceLayersMounted: boolean;
 * }} WorldSessionState */

const SCENE_CLASS_MIGRATE = [
  "is-reveal-bg",
  "is-reveal-fantasy",
  "is-reveal-space",
  "is-bg-ready",
  "is-placeholder-art",
];

const PARKED_LAYERS_CLASS = "world-layers--parked";
const PARKED_COMPRESSED_CLASS = "is-parked-compressed";

/** @type {WorldSessionState | null} */
let session = null;

/**
 * @returns {WorldSessionState | null}
 */
export function getWorldSession() {
  return session;
}

/**
 * @returns {HTMLDivElement | null}
 */
export function getWorldLayers() {
  return session?.layers ?? null;
}

/**
 * @param {WorldSessionState} state
 */
export function registerWorldSession(state) {
  session = state;
}

/**
 * @param {HTMLElement | null | undefined} fromScene
 * @param {HTMLElement} toScene
 */
function migrateSceneWorldState(fromScene, toScene) {
  for (const cls of SCENE_CLASS_MIGRATE) {
    if (fromScene?.classList.contains(cls)) toScene.classList.add(cls);
  }
}

/**
 * Parquea las capas en `body` durante handoff entre rutas mundo (evita flash negro).
 * Conserva el estado de banda (expandido/comprimido) en la propia capa parqueada.
 */
export function parkWorldLayersForHandoff() {
  if (!session?.layers) return;
  const { layers } = session;
  if (!layers.isConnected) return;

  const owner = session.ownerScene;
  const compressed = Boolean(owner?.classList.contains("is-world-band-legal"));

  layers.remove();
  layers.classList.add(PARKED_LAYERS_CLASS);
  layers.classList.toggle(PARKED_COMPRESSED_CLASS, compressed);
  document.body.classList.add("is-world-handoff");
  document.body.appendChild(layers);
}

/**
 * @param {HTMLElement} scene
 * @returns {boolean}
 */
export function attachWorldLayersTo(scene) {
  if (!session?.layers) return false;

  const prev = session.ownerScene;
  if (prev && prev !== scene) migrateSceneWorldState(prev, scene);

  session.layers.classList.remove(PARKED_LAYERS_CLASS, PARKED_COMPRESSED_CLASS);
  document.body.classList.remove("is-world-handoff");

  if (!scene.contains(session.layers)) {
    scene.insertBefore(session.layers, scene.firstChild);
  }

  session.ownerScene = scene;
  void session.layers.offsetWidth;
  return true;
}

/**
 * @param {ParentNode} layers
 * @returns {boolean}
 */
export function worldLayersHaveFantasyMounted(layers) {
  return Boolean(layers.querySelector(".loader-layer--fantasy-scene"));
}

/**
 * @param {ParentNode} layers
 * @returns {boolean}
 */
export function worldLayersHaveSpaceMounted(layers) {
  return Boolean(
    layers.querySelector(".loader-layer--space-orbit")
      || layers.querySelector(".loader-layer--meteor-shower"),
  );
}

/**
 * Conserva flags y referencias de teardown si el DOM ya tiene capas montadas.
 * @param {HTMLElement} ownerScene
 */
export function syncWorldSessionFromDom(ownerScene) {
  if (!session?.layers) return;

  const hasFantasy = worldLayersHaveFantasyMounted(session.layers);
  const hasSpace = worldLayersHaveSpaceMounted(session.layers);

  registerWorldSession({
    ...session,
    ownerScene,
    fantasyLayersMounted: session.fantasyLayersMounted || hasFantasy,
    spaceLayersMounted: session.spaceLayersMounted || hasSpace,
  });
}

/**
 * Desacopla las capas del DOM conservando la sesión (handoff entre rutas).
 */
export function detachWorldLayers() {
  if (!session?.layers) return;
  session.layers.classList.remove(PARKED_LAYERS_CLASS, PARKED_COMPRESSED_CLASS);
  document.body.classList.remove("is-world-handoff");
  session.layers.remove();
}

/**
 * Destruye por completo la sesión y todos los efectos montados.
 */
export function destroyWorldSession() {
  if (!session) return;

  session.teardownLogoMaskSync?.();
  session.spaceOrbitTeardown?.destroy();
  session.meteorTeardown?.destroy();
  session.fantasyBackdropTeardown?.destroy();
  session.fantasyTerrainTeardown?.destroy();
  session.fantasyCloudsTeardown?.destroy();
  session.fantasyCelestialTeardown?.destroy();
  session.fantasySceneTeardown?.destroy();
  session.layers.classList.remove(PARKED_LAYERS_CLASS, PARKED_COMPRESSED_CLASS);
  document.body.classList.remove("is-world-handoff");
  session.layers.remove();
  session = null;
}

/**
 * @param {string} [hash]
 * @returns {boolean}
 */
export function isWorldRouteHash(hash = window.location.hash) {
  const path = (hash || "#/loader").replace(/^#\/?/, "").split("?")[0] || "loader";
  return (
    path === "loader" ||
    path === "home" ||
    path === "account" ||
    path === "auth" ||
    path === "auth/callback" ||
    path.startsWith("legal/")
  );
}
