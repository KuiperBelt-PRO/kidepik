import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useAppTheme, type WorldThemeId } from "../theme";
import { useTypography } from "../theme/useTypography";
import { tokens } from "../theme/tokens";

type Props = {
  compact?: boolean;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

function ThemePill({
  id,
  label,
  colors,
  active,
  onSelect,
}: {
  id: WorldThemeId;
  label: string;
  colors: [string, string];
  active: boolean;
  onSelect: (id: WorldThemeId) => void;
}) {
  const { theme } = useAppTheme();
  const typo = useTypography();
  const scale = useSharedValue(1);

  const anim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      onPress={() => onSelect(id)}
      onPressIn={() => {
        scale.value = withSpring(0.94);
      }}
      onPressOut={() => {
        scale.value = withSpring(1);
      }}
      style={[
        anim,
        styles.pill,
        {
          borderColor: active ? theme.palette.secondary : theme.palette.frameStroke,
          opacity: active ? 1 : 0.8,
        },
      ]}
    >
      {active ? (
        <LinearGradient
          colors={colors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: theme.palette.overlay },
          ]}
        />
      )}
      <Text
        style={[
          styles.label,
          {
            color: active ? theme.palette.onPrimary : theme.palette.secondary,
            fontFamily: typo.body,
          },
        ]}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

export function ThemeToggle({ compact }: Props) {
  const { themeId, setThemeId } = useAppTheme();

  return (
    <View style={[styles.row, compact && styles.compact]}>
      <ThemePill
        id="fantasy"
        label="Fantasía"
        colors={["#2ECC71", "#F0C14A"]}
        active={themeId === "fantasy"}
        onSelect={setThemeId}
      />
      <ThemePill
        id="spaceOpera"
        label="Espacio"
        colors={["#4DA3FF", "#FFFFFF"]}
        active={themeId === "spaceOpera"}
        onSelect={setThemeId}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: tokens.spacing.sm,
    justifyContent: "center",
  },
  compact: {
    transform: [{ scale: 0.92 }],
  },
  pill: {
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.pill,
    borderWidth: 2,
    minHeight: tokens.touchMin / 1.4,
    justifyContent: "center",
    overflow: "hidden",
    minWidth: 110,
    alignItems: "center",
  },
  label: {
    fontSize: tokens.typography.body,
    fontWeight: "700",
  },
});
