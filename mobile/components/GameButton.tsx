import * as Haptics from "expo-haptics";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

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

export function GameButton({
  label,
  onPress,
  variant = "primary",
  disabled,
  style,
}: Props) {
  const { theme } = useAppTheme();
  const typo = useTypography();

  const bg =
    variant === "primary"
      ? theme.palette.primary
      : variant === "secondary"
        ? theme.palette.secondary
        : "transparent";

  const textColor =
    variant === "ghost" ? theme.palette.primary : theme.palette.surface;

  const handlePress = () => {
    if (disabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.();
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: bg,
          borderColor: theme.palette.surfaceBorder,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
          minHeight: tokens.touchMin,
        },
        variant === "ghost" && styles.ghost,
        style,
      ]}
    >
      <Text
        style={[
          styles.label,
          {
            color: textColor,
            fontFamily: typo.body,
          },
        ]}
      >
        {label}
      </Text>
      {variant !== "ghost" ? (
        <View
          style={[styles.shine, { backgroundColor: theme.palette.accentGlow }]}
          pointerEvents="none"
        />
      ) : null}
    </Pressable>
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
  },
  shine: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 4,
    opacity: 0.6,
  },
});
