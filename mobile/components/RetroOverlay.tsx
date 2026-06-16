import { useEffect } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useAppTheme } from "../theme";

const { height: H } = Dimensions.get("window");

/** Scanlines y viñeta retro sutiles. */
export function RetroOverlay() {
  const { theme } = useAppTheme();
  const flicker = useSharedValue(1);

  useEffect(() => {
    if (!theme.retroScanlines) return;
    flicker.value = withRepeat(
      withSequence(
        withTiming(0.92, { duration: 80, easing: Easing.linear }),
        withTiming(1, { duration: 120, easing: Easing.linear }),
      ),
      -1,
      true,
    );
  }, [flicker, theme.retroScanlines]);

  const scanStyle = useAnimatedStyle(() => ({
    opacity: theme.retroScanlines ? 0.04 * flicker.value : 0,
  }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.scanlines, scanStyle]} />
      <View
        style={[
          styles.vignette,
          {
            borderColor: theme.palette.retroGlow,
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scanlines: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "transparent",
    // Rayas horizontales vía sombras repetidas simuladas con borde
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.03)",
  },
  vignette: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 3,
    borderRadius: 0,
    opacity: 0.25,
  },
});
