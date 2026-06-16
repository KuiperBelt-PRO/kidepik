import { useEffect } from "react";
import { Dimensions, StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { useAppTheme } from "../theme";

const { width: W, height: H } = Dimensions.get("window");

const COUNT = 24;
const SEEDS = Array.from({ length: COUNT }, (_, i) => ({
  x: ((i * 67) % 100) / 100,
  y: ((i * 43) % 100) / 100,
  size: 3 + (i % 4) * 2,
  delay: (i % 8) * 200,
}));

function FloatingParticle({
  x,
  y,
  size,
  delay,
  color,
}: {
  x: number;
  y: number;
  size: number;
  delay: number;
  color: string;
}) {
  const float = useSharedValue(0);
  const pulse = useSharedValue(0.3);

  useEffect(() => {
    float.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 2800 + delay, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: 2800 + delay, easing: Easing.inOut(Easing.sin) }),
        ),
        -1,
        false,
      ),
    );
    pulse.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(0.9, { duration: 1200 }),
          withTiming(0.25, { duration: 1200 }),
        ),
        -1,
        true,
      ),
    );
  }, [delay, float, pulse]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: float.value * -18 },
      { scale: 0.8 + pulse.value * 0.4 },
    ],
    opacity: 0.25 + pulse.value * 0.55,
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        style,
        {
          left: x * W - size / 2,
          top: y * H - size / 2,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          shadowColor: color,
        },
      ]}
    />
  );
}

/** Partículas flotantes animadas (runas / estrellas). */
export function ParticleField() {
  const { theme } = useAppTheme();
  const gold = theme.palette.secondary;
  const accent = theme.palette.primary;

  return (
    <Animated.View style={styles.field} pointerEvents="none">
      {SEEDS.map((s, i) => (
        <FloatingParticle
          key={i}
          x={s.x}
          y={s.y}
          size={s.size}
          delay={s.delay}
          color={i % 3 === 0 ? gold : accent}
        />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  field: {
    ...StyleSheet.absoluteFillObject,
  },
  particle: {
    position: "absolute",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 4,
  },
});
