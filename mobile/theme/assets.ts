import type { ImageSourcePropType } from "react-native";

import type { WorldThemeId } from "./types";

/**
 * Resolución de assets por tema.
 *
 * Fase actual: placeholders `null` → los componentes dibujan SVG en código.
 * Fase futura: sustituir por PNG/SVG generados con IA en
 * `mobile/assets/themes/{fantasy|spaceOpera}/`.
 */
export type AssetSlot =
  | "loaderBackdrop"
  | "dialoguePortrait"
  | "mapBackground"
  | "rewardIcon"
  | "worldCardFantasy"
  | "worldCardSpace";

const PLACEHOLDERS: Record<WorldThemeId, Record<AssetSlot, null>> = {
  fantasy: {
    loaderBackdrop: null,
    dialoguePortrait: null,
    mapBackground: null,
    rewardIcon: null,
    worldCardFantasy: null,
    worldCardSpace: null,
  },
  spaceOpera: {
    loaderBackdrop: null,
    dialoguePortrait: null,
    mapBackground: null,
    rewardIcon: null,
    worldCardFantasy: null,
    worldCardSpace: null,
  },
};

export function resolveThemeAsset(
  themeId: WorldThemeId,
  slot: AssetSlot,
): ImageSourcePropType | null {
  return PLACEHOLDERS[themeId][slot];
}
