import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useAppTheme } from "../theme";

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Fondo con gradiente temático y scanlines retro opcionales (space). */
export function ThemeBackground({ children, style }: Props) {
  const { theme } = useAppTheme();
  const { palette, retroScanlines } = theme;

  return (
    <View style={[styles.root, style]}>
      <LinearGradient
        colors={[palette.backgroundTop, palette.backgroundBottom]}
        style={StyleSheet.absoluteFill}
      />
      {retroScanlines ? (
        <View style={styles.scanlineOverlay} pointerEvents="none" />
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scanlineOverlay: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.05,
    backgroundColor: "transparent",
    borderTopWidth: 1,
    borderTopColor: "#fff",
    // Efecto retro sutil; sustituir por textura raster en fase IA si se desea.
  },
});
