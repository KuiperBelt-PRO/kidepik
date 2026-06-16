import type { AppTheme } from "./types";

export const spaceOperaTheme: AppTheme = {
  id: "spaceOpera",
  palette: {
    primary: "#2EC4E8",
    primaryMuted: "#1A8FA8",
    secondary: "#FF6B9D",
    backgroundTop: "#050B18",
    backgroundBottom: "#0D1B2A",
    surface: "#E8F4F8",
    surfaceBorder: "#2EC4E8",
    narrative: "#0A1628",
    narrativeMuted: "#4A6A8A",
    success: "#3DDBA0",
    hint: "#FFB347",
    danger: "#FF5C5C",
    overlay: "rgba(5, 11, 24, 0.8)",
    accentGlow: "rgba(46, 196, 232, 0.4)",
    frameStroke: "#2EC4E8",
    frameFill: "rgba(46, 196, 232, 0.08)",
  },
  typography: {
    displayFamily: "Orbitron_700Bold",
    bodyFamily: "Nunito_600SemiBold",
  },
  labels: {
    worldName: "Sector Alfa",
    progressUnit: "Módulo",
    hintLabel: "Datos del navegador",
    continueLabel: "Continuar",
  },
  particleKind: "star",
  retroScanlines: true,
};
