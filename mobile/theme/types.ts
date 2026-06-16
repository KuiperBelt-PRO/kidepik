export type WorldThemeId = "fantasy" | "spaceOpera";

export type ParticleKind = "sparkle" | "star";

export type ThemePalette = {
  primary: string;
  primaryMuted: string;
  secondary: string;
  backgroundTop: string;
  backgroundBottom: string;
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
