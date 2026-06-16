import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { fantasyTheme } from "./fantasy";
import { spaceOperaTheme } from "./spaceOpera";
import type { AppTheme, WorldThemeId } from "./types";

type ThemeContextValue = {
  theme: AppTheme;
  themeId: WorldThemeId;
  setThemeId: (id: WorldThemeId) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const themes: Record<WorldThemeId, AppTheme> = {
  fantasy: fantasyTheme,
  spaceOpera: spaceOperaTheme,
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [themeId, setThemeId] = useState<WorldThemeId>("fantasy");

  const toggleTheme = useCallback(() => {
    setThemeId((current) => (current === "fantasy" ? "spaceOpera" : "fantasy"));
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: themes[themeId],
      themeId,
      setThemeId,
      toggleTheme,
    }),
    [themeId, toggleTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useAppTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useAppTheme debe usarse dentro de ThemeProvider");
  }
  return ctx;
}
