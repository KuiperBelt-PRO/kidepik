export type WorldThemeId = "fantasy" | "spaceOpera";

export type ParticleKind = "sparkle" | "star";

export type ThemePalette = {
  primary: string;
  primaryMuted: string;
  secondary: string;
  onPrimary: string;
  backgroundTop: string;
  backgroundMid: string;
  backgroundBottom: string;
  /** Tres paradas para degradados de fondo y paneles. */
  gradientStops: readonly [string, string, string];
  buttonGradient: readonly [string, string];
  surface: string;
  surfaceBorder: string;
  narrative: string;
  narrativeMuted: string;
  success: string;
  hint: string;
  danger: string;
  overlay: string;
  accentGlow: string;
  frameStroke: string;
  frameFill: string;
  /** Brillo retro en bordes y HUD. */
  retroGlow: string;
};

export type ThemeTypography = {
  displayFamily: string;
  bodyFamily: string;
};

export type ThemeLabels = {
  worldName: string;
  progressUnit: string;
  hintLabel: string;
  continueLabel: string;
};

export type AppTheme = {
  id: WorldThemeId;
  palette: ThemePalette;
  typography: ThemeTypography;
  labels: ThemeLabels;
  particleKind: ParticleKind;
  retroScanlines: boolean;
};
