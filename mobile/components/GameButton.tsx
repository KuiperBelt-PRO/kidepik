import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { useAppTheme } from "../theme";
import { useTypography } from "../theme/useTypography";
import { tokens } from "../theme/tokens";

type Variant = "primary" | "secondary" | "ghost";

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function GameButton({
  label,
  onPress,
  variant = "primary",
  disabled,
  style,
}: Props) {
  const { theme } = useAppTheme();
  const typo = useTypography();
  const scale = useSharedValue(1);

  const isGhost = variant === "ghost";
  const gradientColors: readonly [string, string] =
    variant === "secondary"
      ? [theme.palette.secondary, theme.palette.primary]
      : theme.palette.buttonGradient;

  const textColor = isGhost
    ? theme.palette.secondary
    : variant === "secondary" && theme.id === "spaceOpera"
      ? theme.palette.onPrimary
      : theme.palette.onPrimary;

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 14, stiffness: 280 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 220 });
  };

  const handlePress = () => {
    if (disabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  return (
    <AnimatedPressable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      style={[
        animStyle,
        styles.button,
        {
          borderColor: theme.palette.surfaceBorder,
          opacity: disabled ? 0.5 : 1,
          minHeight: tokens.touchMin,
          backgroundColor: isGhost ? "transparent" : undefined,
        },
        isGhost && styles.ghost,
        style,
      ]}
    >
      {!isGhost ? (
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      <View
        style={[
          styles.shine,
          { backgroundColor: theme.palette.retroGlow },
        ]}
        pointerEvents="none"
      />
      <Text
        style={[
          styles.label,
          {
            color: textColor,
            fontFamily: typo.body,
            textShadowColor: theme.palette.retroGlow,
            textShadowRadius: isGhost ? 0 : 6,
          },
        ]}
      >
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: tokens.radius.md,
    borderWidth: 2,
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  ghost: {
    borderWidth: 2,
    backgroundColor: "transparent",
  },
  label: {
    fontSize: tokens.typography.body,
    textAlign: "center",
    fontWeight: "700",
  },
  shine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 5,
    opacity: 0.55,
  },
});
