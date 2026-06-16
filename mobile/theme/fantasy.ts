import type { AppTheme } from "./types";

export const fantasyTheme: AppTheme = {
  id: "fantasy",
  palette: {
    primary: "#7B4FD4",
    primaryMuted: "#5A3A9E",
    secondary: "#D4A84B",
    backgroundTop: "#1A0F2E",
    backgroundBottom: "#2D1B4E",
    surface: "#F5EED8",
    surfaceBorder: "#C9A227",
    narrative: "#2A1F3D",
    narrativeMuted: "#5C4D72",
    success: "#3D8B5E",
    hint: "#8B6914",
    danger: "#B84A4A",
    overlay: "rgba(26, 15, 46, 0.75)",
    accentGlow: "rgba(201, 162, 39, 0.45)",
    frameStroke: "#C9A227",
    frameFill: "rgba(245, 238, 216, 0.12)",
  },
  typography: {
    displayFamily: "Cinzel_700Bold",
    bodyFamily: "Nunito_600SemiBold",
  },
  labels: {
    worldName: "Reinos Unidos",
    progressUnit: "Runa",
    hintLabel: "Pista del sabio",
    continueLabel: "Continuar",
  },
  particleKind: "sparkle",
  retroScanlines: false,
};
