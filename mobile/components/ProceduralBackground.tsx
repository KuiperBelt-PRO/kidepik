import { useMemo } from "react";
import { Dimensions, StyleSheet, View } from "react-native";
import { LinearGradient as ExpoGradient } from "expo-linear-gradient";
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
} from "react-native-svg";

import { useAppTheme } from "../theme";

const { width: W, height: H } = Dimensions.get("window");

const STAR_COUNT = 55;
const STARS = Array.from({ length: STAR_COUNT }, (_, i) => ({
  x: ((i * 73) % 100) / 100,
  y: ((i * 41) % 100) / 100,
  r: 0.6 + (i % 4) * 0.5,
}));

const SPARK_COUNT = 28;
const SPARKS = Array.from({ length: SPARK_COUNT }, (_, i) => ({
  x: ((i * 59) % 100) / 100,
  y: ((i * 83) % 100) / 100,
  r: 1 + (i % 3),
}));

function fantasyHillsPath(offsetY: number): string {
  const base = H * 0.72 + offsetY;
  return [
    `M 0 ${H}`,
    `L 0 ${base}`,
    `Q ${W * 0.2} ${base - 40} ${W * 0.35} ${base + 10}`,
    `T ${W * 0.55} ${base - 20}`,
    `T ${W * 0.75} ${base + 15}`,
    `T ${W} ${base - 10}`,
    `L ${W} ${H}`,
    "Z",
  ].join(" ");
}

/** Fondos procedurales con SVG + degradados (sin Skia — compatible Expo Go y web). */
export function ProceduralBackground() {
  const { theme } = useAppTheme();
  const isFantasy = theme.id === "fantasy";
  const { palette } = theme;

  const hillsBack = useMemo(() => fantasyHillsPath(28), []);
  const hillsFront = useMemo(() => fantasyHillsPath(0), []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <ExpoGradient
        colors={[...palette.gradientStops]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      <ExpoGradient
        colors={[
          "transparent",
          isFantasy ? "rgba(61,219,126,0.14)" : "rgba(77,163,255,0.18)",
          isFantasy ? "rgba(240,193,74,0.1)" : "rgba(255,255,255,0.08)",
        ]}
        style={StyleSheet.absoluteFill}
      />
      <Svg width={W} height={H} style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="nebula" x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={palette.primary} stopOpacity={0.35} />
            <Stop offset="100%" stopColor={palette.secondary} stopOpacity={0.2} />
          </LinearGradient>
        </Defs>

        {isFantasy ? (
          <>
            <Path d={hillsBack} fill="rgba(8, 40, 24, 0.88)" />
            <Path d={hillsFront} fill="rgba(15, 70, 40, 0.92)" />
            {SPARKS.map((s, i) => (
              <Circle
                key={`spark-${i}`}
                cx={s.x * W}
                cy={s.y * H * 0.82}
                r={s.r}
                fill={i % 2 === 0 ? palette.secondary : palette.primary}
                opacity={0.4 + (i % 5) * 0.1}
              />
            ))}
            <Circle
              cx={W * 0.5}
              cy={H * 0.2}
              r={W * 0.38}
              fill="url(#nebula)"
              opacity={0.5}
            />
          </>
        ) : (
          <>
            {STARS.map((s, i) => (
              <Circle
                key={`star-${i}`}
                cx={s.x * W}
                cy={s.y * H}
                r={s.r}
                fill={i % 4 === 0 ? palette.secondary : palette.primary}
                opacity={0.45 + (i % 6) * 0.1}
              />
            ))}
            <Circle
              cx={W * 0.65}
              cy={H * 0.22}
              r={W * 0.42}
              fill="url(#nebula)"
              opacity={0.45}
            />
            {Array.from({ length: 10 }).map((_, i) => {
              const y = H * 0.86 + i * 12;
              return (
                <Line
                  key={`grid-${i}`}
                  x1={0}
                  y1={y}
                  x2={W}
                  y2={y}
                  stroke="rgba(200, 230, 255, 0.14)"
                  strokeWidth={1}
                />
              );
            })}
          </>
        )}
      </Svg>
    </View>
  );
}
