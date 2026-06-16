import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { useAppTheme } from "../theme";
import { tokens } from "../theme/tokens";

type Props = {
  label: string;
  subject: string;
  unlocked?: boolean;
  active?: boolean;
  onPress?: () => void;
};

/** Nodo del mapa de progreso (planeta o reino). */
export function MapNode({
  label,
  subject,
  unlocked = true,
  active,
  onPress,
}: Props) {
  const { theme } = useAppTheme();

  const fill = active
    ? theme.palette.primary
    : unlocked
      ? theme.palette.primaryMuted
      : theme.palette.narrativeMuted;

  return (
    <Pressable
      onPress={unlocked ? onPress : undefined}
      style={({ pressed }) => [
        styles.node,
        {
          opacity: unlocked ? (pressed ? 0.8 : 1) : 0.45,
          borderColor: theme.palette.surfaceBorder,
        },
      ]}
    >
      <Svg width={48} height={48} viewBox="0 0 48 48">
        {theme.id === "fantasy" ? (
          <Path
            d="M24 4 L40 14 L40 34 L24 44 L8 34 L8 14 Z"
            fill={fill}
            stroke={theme.palette.secondary}
            strokeWidth={2}
          />
        ) : (
          <Circle
            cx={24}
            cy={24}
            r={18}
            fill={fill}
            stroke={theme.palette.secondary}
            strokeWidth={2}
          />
        )}
      </Svg>
      <Text
        style={[
          styles.label,
          {
              color: theme.palette.secondary,
            fontFamily: theme.typography.displayFamily,
          },
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <Text
        style={[
          styles.subject,
          {
            color: theme.palette.narrativeMuted,
            fontFamily: theme.typography.bodyFamily,
          },
        ]}
        numberOfLines={1}
      >
        {subject}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  node: {
    alignItems: "center",
    padding: tokens.spacing.sm,
    minWidth: 88,
    borderWidth: 1,
    borderRadius: tokens.radius.md,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  label: {
    fontSize: 12,
    marginTop: tokens.spacing.xs,
    textAlign: "center",
  },
  subject: {
    fontSize: 11,
    textAlign: "center",
  },
});
