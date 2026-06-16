import type { AppTheme } from "./types";

/** Space opera: azul cósmico + blanco (predominantes). */
export const spaceOperaTheme: AppTheme = {
  id: "spaceOpera",
  palette: {
    primary: "#4DA3FF",
    primaryMuted: "#1E6FD9",
    secondary: "#FFFFFF",
    onPrimary: "#001233",
    backgroundTop: "#000510",
    backgroundMid: "#0A2472",
    backgroundBottom: "#001845",
    gradientStops: ["#000510", "#0D47A1", "#001A4D"],
    buttonGradient: ["#5BB5FF", "#1E88E5"],
    surface: "rgba(248, 251, 255, 0.94)",
    surfaceBorder: "#90CAF9",
    narrative: "#051428",
    narrativeMuted: "#5C7A9E",
    success: "#69F0AE",
    hint: "#FFD54F",
    danger: "#FF6B6B",
    overlay: "rgba(0, 5, 16, 0.85)",
    accentGlow: "rgba(144, 202, 249, 0.5)",
    frameStroke: "#E3F2FD",
    frameFill: "rgba(77, 163, 255, 0.14)",
    retroGlow: "rgba(77, 163, 255, 0.4)",
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
