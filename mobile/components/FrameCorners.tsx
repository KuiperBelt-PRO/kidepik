import Svg, { Path } from "react-native-svg";

import { useAppTheme } from "../theme";
import { tokens } from "../theme/tokens";

type Props = {
  width: number;
  height: number;
};

/** ASSET_SLOT: frameCorners — esquinas ornamentales vectoriales por tema. */
export function FrameCorners({ width, height }: Props) {
  const { theme } = useAppTheme();
  const { frameStroke, frameFill } = theme.palette;
  const s = tokens.frame.cornerSize;

  if (theme.id === "fantasy") {
    return (
      <Svg width={width} height={height} style={{ position: "absolute" }}>
        <Path
          d={`M0,${s} L0,0 L${s},0 M${width - s},0 L${width},0 L${width},${s} M${width},${height - s} L${width},${height} L${width - s},${height} M0,${height - s} L0,${height} L${s},${height}`}
          stroke={frameStroke}
          strokeWidth={tokens.frame.borderWidth}
          fill="none"
        />
        <Path
          d={`M4,${s - 4} Q4,4 ${s - 4},4 M${width - s + 4},4 Q${width - 4},4 ${width - 4},${s - 4}`}
          stroke={frameFill}
          strokeWidth={1}
          fill="none"
        />
      </Svg>
    );
  }

  return (
    <Svg width={width} height={height} style={{ position: "absolute" }}>
      <Path
        d={`M0,${s} L0,0 L${s},0 M${width - s},0 L${width},0 L${width},${s} M${width},${height - s} L${width},${height} L${width - s},${height} M0,${height - s} L0,${height} L${s},${height}`}
        stroke={frameStroke}
        strokeWidth={tokens.frame.borderWidth}
        fill="none"
      />
      <Path
        d={`M8,8 L${s},8 M${width - s},8 L${width - 8},8 M8,${height - 8} L${s},${height - 8} M${width - s},${height - 8} L${width - 8},${height - 8}`}
        stroke={frameStroke}
        strokeWidth={1}
        opacity={0.5}
        fill="none"
      />
    </Svg>
  );
}
