import { useEffect, useState } from "react";
import { useFonts } from "expo-font";
import { Cinzel_700Bold } from "@expo-google-fonts/cinzel";
import { Nunito_600SemiBold } from "@expo-google-fonts/nunito";
import { Orbitron_700Bold } from "@expo-google-fonts/orbitron";

const BOOT_TIMEOUT_MS = 2500;

/**
 * Carga fuentes Google sin bloquear la app.
 * `fontsReady` solo true si cargaron bien; si no, la UI usa fuente del sistema.
 */
export function useBootstrapFonts() {
  const [fontsLoaded, fontError] = useFonts({
    Cinzel_700Bold,
    Nunito_600SemiBold,
    Orbitron_700Bold,
  });
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (fontsLoaded || fontError) return;
    const timer = setTimeout(() => setTimedOut(true), BOOT_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [fontsLoaded, fontError]);

  const fontsReady = fontsLoaded && !fontError;

  return { fontsReady, fontError, timedOut };
}
