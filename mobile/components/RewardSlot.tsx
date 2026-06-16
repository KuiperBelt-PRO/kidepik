import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Svg, { Path, Rect } from "react-native-svg";

import { useAppTheme } from "../theme";
import { useTypography } from "../theme/useTypography";
import { tokens } from "../theme/tokens";

type Props = {
  itemName: string;
  description: string;
};

/** ASSET_SLOT: rewardIcon — icono del objeto narrativo. */
function RewardIcon() {
  const { theme } = useAppTheme();

  if (theme.id === "fantasy") {
    return (
      <Svg width={40} height={40} viewBox="0 0 40 40">
        <Path
          d="M20 4 L24 14 L36 14 L26 20 L30 32 L20 26 L10 32 L14 20 L4 14 L16 14 Z"
          fill={theme.palette.secondary}
          stroke={theme.palette.frameStroke}
          strokeWidth={1}
        />
      </Svg>
    );
  }

  return (
    <Svg width={40} height={40} viewBox="0 0 40 40">
      <Rect
        x={8}
        y={12}
        width={24}
        height={16}
        rx={2}
        fill={theme.palette.secondary}
        stroke={theme.palette.frameStroke}
        strokeWidth={1}
      />
      <Path
        d="M14 12 L20 6 L26 12"
        fill="none"
        stroke={theme.palette.primary}
        strokeWidth={2}
      />
    </Svg>
  );
}

export function RewardSlot({ itemName, description }: Props) {
  const { theme } = useAppTheme();
  const typo = useTypography();

  return (
    <View
      style={[
        styles.slot,
        {
          borderColor: theme.palette.surfaceBorder,
          shadowColor: theme.palette.retroGlow,
        },
      ]}
    >
      <LinearGradient
        colors={[theme.palette.primary, theme.palette.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["transparent", "rgba(255,255,255,0.25)"]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.icon}>
        <RewardIcon />
      </View>
      <View style={styles.text}>
        <Text
          style={[
            styles.name,
            {
              color: theme.palette.onPrimary,
              fontFamily: typo.display,
            },
          ]}
        >
          {itemName}
        </Text>
        <Text
          style={[
            styles.desc,
            {
              color: theme.palette.onPrimary,
              fontFamily: typo.body,
              opacity: 0.88,
            },
          ]}
        >
          {description}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  slot: {
    flexDirection: "row",
    borderWidth: 2,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    gap: tokens.spacing.md,
    alignItems: "center",
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 5,
  },
  icon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
  },
  name: {
    fontSize: tokens.typography.body,
    marginBottom: tokens.spacing.xs,
  },
  desc: {
    fontSize: tokens.typography.bodySm,
    lineHeight: 20,
  },
});
