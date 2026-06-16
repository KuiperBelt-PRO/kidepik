import { useAppTheme } from "./ThemeProvider";
import { useFontsReady } from "./FontContext";

/** Tipografías del tema; usa sistema si las fuentes custom aún no cargaron. */
export function useTypography() {
  const { theme } = useAppTheme();
  const fontsReady = useFontsReady();

  return {
    display: fontsReady ? theme.typography.displayFamily : undefined,
    body: fontsReady ? theme.typography.bodyFamily : undefined,
  };
}
