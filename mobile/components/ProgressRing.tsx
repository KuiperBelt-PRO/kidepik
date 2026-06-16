import { StyleSheet, View } from "react-native";
import Svg, { Circle, G } from "react-native-svg";

import { useAppTheme } from "../theme";
import { tokens } from "../theme/tokens";

type Props = {
  progress: number;
  size?: number;
};

/** Anillo de progreso SVG — sin Skia/Reanimated para máxima compatibilidad en Expo Go. */
export function ProgressRing({ progress, size = tokens.loader.ringSize }: Props) {
  const { theme } = useAppTheme();
  const clamped = Math.min(1, Math.max(0, progress));

  const stroke = tokens.loader.ringStroke;
  const radius = (size - stroke) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size}>
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
            stroke={theme.palette.primary}
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
          r={radius * 0.65}
          fill={theme.palette.accentGlow}
          opacity={0.35}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
});
