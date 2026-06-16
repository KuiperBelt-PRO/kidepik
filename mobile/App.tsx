import { useCallback, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { GameButton } from "./components/GameButton";
import { useBootstrapFonts } from "./hooks/useBootstrapFonts";
import type { MockupId } from "./mockups/catalog";
import { MockupScreen } from "./mockups/MockupScreen";
import { WorldPickerMock } from "./mockups/WorldPickerMock";
import { DesignGalleryScreen } from "./screens/DesignGalleryScreen";
import { LoaderScreen } from "./screens/LoaderScreen";
import { PocArchitectureScreen } from "./screens/PocArchitectureScreen";
import { FontProvider } from "./theme/FontContext";
import { ThemeProvider, useAppTheme } from "./theme";

type Route =
  | "loader"
  | "gallery"
  | "mockup"
  | "worldPicker"
  | "poc";

function AppRoot() {
  const [route, setRoute] = useState<Route>("loader");
  const [activeMockup, setActiveMockup] = useState<MockupId>("dialogue");
  const { setThemeId } = useAppTheme();

  const goGallery = useCallback(() => setRoute("gallery"), []);

  const openMockup = useCallback((id: MockupId) => {
    setActiveMockup(id);
    setRoute("mockup");
  }, []);

  if (route === "loader") {
    return <LoaderScreen onComplete={goGallery} />;
  }

  if (route === "worldPicker") {
    return (
      <View style={styles.flex}>
        <WorldPickerMock
          onPickFantasy={() => {
            setThemeId("fantasy");
            goGallery();
          }}
          onPickSpace={() => {
            setThemeId("spaceOpera");
            goGallery();
          }}
        />
        <View style={styles.backBar}>
          <GameButton label="← Galería" variant="ghost" onPress={goGallery} />
        </View>
      </View>
    );
  }

  if (route === "mockup") {
    return (
      <View style={styles.flex}>
        <MockupScreen mockupId={activeMockup} />
        <View style={styles.backBar}>
          <GameButton label="← Galería" variant="ghost" onPress={goGallery} />
        </View>
      </View>
    );
  }

  if (route === "poc") {
    return <PocArchitectureScreen onBack={goGallery} />;
  }

  return (
    <DesignGalleryScreen
      onOpenMockup={openMockup}
      onOpenWorldPicker={() => setRoute("worldPicker")}
      onOpenPoc={() => setRoute("poc")}
    />
  );
}

export default function App() {
  const { fontsReady } = useBootstrapFonts();

  return (
    <GestureHandlerRootView style={styles.flex}>
      <FontProvider fontsReady={fontsReady}>
        <ThemeProvider>
          <StatusBar style="light" />
          <AppRoot />
        </ThemeProvider>
      </FontProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backBar: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
  },
});
