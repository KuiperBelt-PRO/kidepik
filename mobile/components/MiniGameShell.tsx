import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { useEffect } from "react";

import { useAppTheme } from "../theme";
import { useTypography } from "../theme/useTypography";
import { tokens } from "../theme/tokens";

type Props = {
  title?: string;
};

/** Contenedor placeholder para minijuegos táctiles futuros. */
export function MiniGameShell({ title = "Minijuego" }: Props) {
  const { theme } = useAppTheme();
  const typo = useTypography();
  const pulse = useSharedValue(0);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 2200 }), -1, true);
  }, [pulse]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.25 + pulse.value * 0.35,
  }));

  return (
    <View
      style={[
        styles.shell,
        {
          borderColor: theme.palette.surfaceBorder,
          shadowColor: theme.palette.retroGlow,
        },
      ]}
    >
      <LinearGradient
        colors={[theme.palette.backgroundMid, theme.palette.backgroundBottom]}
        style={StyleSheet.absoluteFill}
      />
      <Text
        style={[
          styles.title,
          {
            color: theme.palette.secondary,
            fontFamily: typo.display,
            textShadowColor: theme.palette.retroGlow,
            textShadowRadius: 8,
          },
        ]}
      >
        {title}
      </Text>
      <View
        style={[
          styles.canvas,
          { borderColor: theme.palette.primary },
        ]}
      >
        <Animated.View style={[styles.glow, glowStyle]}>
          <LinearGradient
            colors={[theme.palette.primary, theme.palette.secondary]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        <Text
          style={[
            styles.placeholder,
            {
              color: theme.palette.secondary,
              fontFamily: typo.body,
            },
          ]}
        >
          Zona de juego táctil
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    borderWidth: 2,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.md,
    minHeight: 200,
    overflow: "hidden",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 4,
  },
  title: {
    fontSize: tokens.typography.body,
    marginBottom: tokens.spacing.sm,
  },
  canvas: {
    flex: 1,
    minHeight: 140,
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: tokens.radius.md,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  glow: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: tokens.radius.md,
  },
  placeholder: {
    fontSize: tokens.typography.bodySm,
    fontWeight: "600",
  },
});
