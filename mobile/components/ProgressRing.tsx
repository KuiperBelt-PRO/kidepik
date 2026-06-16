import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Defs, G, LinearGradient as SvgGradient, Stop } from "react-native-svg";

import { useAppTheme } from "../theme";
import { tokens } from "../theme/tokens";

type Props = {
  progress: number;
  size?: number;
};

const AnimatedView = Animated.createAnimatedComponent(View);

export function ProgressRing({ progress, size = tokens.loader.ringSize }: Props) {
  const { theme } = useAppTheme();
  const clamped = Math.min(1, Math.max(0, progress));
  const pulse = useSharedValue(1);

  const stroke = tokens.loader.ringStroke;
  const radius = (size - stroke) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);

  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 900, easing: Easing.inOut(Easing.sin) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      true,
    );
  }, [pulse]);

  const wrapStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const { primary, secondary } = theme.palette;

  return (
    <AnimatedView style={[styles.wrap, wrapStyle, { width: size, height: size }]}>
      <View
        style={[
          styles.glow,
          {
            width: size * 1.2,
            height: size * 1.2,
            borderRadius: size,
            backgroundColor: theme.palette.accentGlow,
          },
        ]}
      />
      <Svg width={size} height={size}>
        <Defs>
          <SvgGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={primary} />
            <Stop offset="100%" stopColor={secondary} />
          </SvgGradient>
        </Defs>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={theme.palette.frameFill}
          strokeWidth={stroke}
          fill="none"
        />
        <G rotation="-90" origin={`${center}, ${center}`}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke="url(#ringGrad)"
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={offset}
          />
        </G>
        <Circle
          cx={center}
          cy={center}
          r={radius * 0.55}
          fill={theme.palette.accentGlow}
          opacity={0.4}
        />
      </Svg>
      <LinearGradient
        colors={[primary, secondary]}
        style={[styles.core, { width: size * 0.28, height: size * 0.28, borderRadius: size }]}
      />
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  glow: {
    position: "absolute",
    opacity: 0.45,
  },
  core: {
    position: "absolute",
    opacity: 0.85,
  },
});
