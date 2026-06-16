import type { AppTheme } from "./types";

/** Fantasía: verde bosque + dorado (predominantes). */
export const fantasyTheme: AppTheme = {
  id: "fantasy",
  palette: {
    primary: "#3DDB7E",
    primaryMuted: "#1F8B4C",
    secondary: "#F0C14A",
    onPrimary: "#062112",
    backgroundTop: "#03180A",
    backgroundMid: "#145A32",
    backgroundBottom: "#082818",
    gradientStops: ["#03180A", "#1A6B3F", "#0C3D22"],
    buttonGradient: ["#2ECC71", "#1A9B52"],
    surface: "rgba(255, 248, 230, 0.94)",
    surfaceBorder: "#D4AF37",
    narrative: "#0F3320",
    narrativeMuted: "#3D6B4F",
    success: "#2ECC71",
    hint: "#B8860B",
    danger: "#C94A4A",
    overlay: "rgba(3, 24, 10, 0.82)",
    accentGlow: "rgba(240, 193, 74, 0.55)",
    frameStroke: "#E8C547",
    frameFill: "rgba(61, 219, 126, 0.18)",
    retroGlow: "rgba(61, 219, 126, 0.35)",
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
