/**
 * Layout compacto de compose en play (chips en el log, no en el pie).
 * @module play-compose-layout
 */

/**
 * @param {string} mode
 * @param {{ useChoiceCards?: boolean }} [opts]
 * @returns {boolean}
 */
export function shouldRenderChoiceChips(mode, opts = {}) {
  if (opts.useChoiceCards) return false;
  return mode === "options_only" || mode === "options_or_text" || mode === "continue";
}
