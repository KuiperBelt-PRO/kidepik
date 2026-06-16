import { createContext, useContext, type ReactNode } from "react";

type FontContextValue = {
  fontsReady: boolean;
};

const FontContext = createContext<FontContextValue>({ fontsReady: false });

export function FontProvider({
  fontsReady,
  children,
}: {
  fontsReady: boolean;
  children: ReactNode;
}) {
  return (
    <FontContext.Provider value={{ fontsReady }}>
      {children}
    </FontContext.Provider>
  );
}

export function useFontsReady(): boolean {
  return useContext(FontContext).fontsReady;
}

/** Devuelve fontFamily custom o undefined (sistema) si aun no cargaron. */
export function useResolvedFontFamily(custom?: string): string | undefined {
  const ready = useFontsReady();
  return ready && custom ? custom : undefined;
}
