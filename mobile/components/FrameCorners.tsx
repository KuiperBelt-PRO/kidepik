import Svg, { Circle, Path } from "react-native-svg";

import { useAppTheme } from "../theme";
import { tokens } from "../theme/tokens";

type Props = {
  width: number;
  height: number;
};

/** Esquinas ornamentales retro por tema. */
export function FrameCorners({ width, height }: Props) {
  const { theme } = useAppTheme();
  const { frameStroke, frameFill, primary, secondary } = theme.palette;
  const s = tokens.frame.cornerSize;

  if (theme.id === "fantasy") {
    return (
      <Svg width={width} height={height} style={{ position: "absolute" }}>
        <Path
          d={`M0,${s} L0,0 L${s},0 M${width - s},0 L${width},0 L${width},${s} M${width},${height - s} L${width},${height} L${width - s},${height} M0,${height - s} L0,${height} L${s},${height}`}
          stroke={frameStroke}
          strokeWidth={3}
          fill="none"
        />
        <Path
          d={`M6,${s} Q6,6 ${s},6 M${width - s},6 Q${width - 6},6 ${width - 6},${s}`}
          stroke={primary}
          strokeWidth={1.5}
          fill="none"
          opacity={0.7}
        />
        <Circle cx={12} cy={12} r={3} fill={secondary} opacity={0.8} />
        <Circle cx={width - 12} cy={12} r={3} fill={secondary} opacity={0.8} />
        <Circle cx={12} cy={height - 12} r={3} fill={primary} opacity={0.6} />
        <Circle cx={width - 12} cy={height - 12} r={3} fill={primary} opacity={0.6} />
        <Path
          d={`M${s},2 L${s + 8},2 M2,${s} L2,${s + 8}`}
          stroke={frameFill}
          strokeWidth={2}
        />
      </Svg>
    );
  }

  return (
    <Svg width={width} height={height} style={{ position: "absolute" }}>
      <Path
        d={`M0,${s} L0,0 L${s},0 M${width - s},0 L${width},0 L${width},${s} M${width},${height - s} L${width},${height} L${width - s},${height} M0,${height - s} L0,${height} L${s},${height}`}
        stroke={frameStroke}
        strokeWidth={2}
        fill="none"
      />
      <Path
        d={`M8,8 L${s + 4},8 M${width - s - 4},8 L${width - 8},8`}
        stroke={primary}
        strokeWidth={1}
        opacity={0.8}
      />
      <Path
        d={`M8,${height - 8} L${s + 4},${height - 8} M${width - s - 4},${height - 8} L${width - 8},${height - 8}`}
        stroke={secondary}
        strokeWidth={1}
        opacity={0.5}
      />
      <Circle cx={10} cy={10} r={2} fill={secondary} />
      <Circle cx={width - 10} cy={10} r={2} fill={primary} />
    </Svg>
  );
}
