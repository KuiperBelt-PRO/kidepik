import { Dimensions, StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";

import { useAppTheme } from "../theme";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

const PARTICLES = Array.from({ length: 20 }, (_, i) => ({
  x: ((i * 97) % 100) / 100,
  y: ((i * 53) % 100) / 100,
  r: 1.5 + (i % 3),
}));

/** Partículas decorativas (SVG estático) — sin Skia para máxima compatibilidad Expo Go. */
export function ParticleField() {
  const { theme } = useAppTheme();
  const color =
    theme.particleKind === "sparkle"
      ? theme.palette.secondary
      : theme.palette.primary;

  return (
    <View style={styles.field} pointerEvents="none">
      <Svg width={SCREEN_W} height={SCREEN_H}>
        {PARTICLES.map((p, i) => (
          <Circle
            key={i}
            cx={p.x * SCREEN_W}
            cy={p.y * SCREEN_H}
            r={p.r}
            fill={color}
            opacity={0.25 + (i % 4) * 0.08}
          />
        ))}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    ...StyleSheet.absoluteFillObject,
  },
});
