import { useState, type ReactNode } from "react";
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { FrameCorners } from "./FrameCorners";
import { useAppTheme } from "../theme";
import { useTypography } from "../theme/useTypography";
import { tokens } from "../theme/tokens";

type Props = {
  children: ReactNode;
  title?: string;
  style?: StyleProp<ViewStyle>;
};

export function GamePanel({ children, title, style }: Props) {
  const { theme } = useAppTheme();
  const typo = useTypography();
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  return (
    <View
      style={[
        styles.outer,
        {
          borderColor: theme.palette.surfaceBorder,
          shadowColor: theme.palette.retroGlow,
        },
        style,
      ]}
      onLayout={onLayout}
    >
      <LinearGradient
        colors={[
          theme.palette.surface,
          theme.id === "fantasy"
            ? "rgba(255, 248, 220, 0.98)"
            : "rgba(240, 248, 255, 0.98)",
        ]}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={["transparent", theme.palette.frameFill]}
        style={styles.sheen}
      />
      {size.width > 0 ? (
        <FrameCorners width={size.width} height={size.height} />
      ) : null}
      {title ? (
        <View style={styles.titleRow}>
          <LinearGradient
            colors={[theme.palette.primary, theme.palette.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.titleBadge}
          >
            <Text
              style={[
                styles.title,
                {
                  color: theme.palette.onPrimary,
                  fontFamily: typo.display,
                },
              ]}
            >
              {title}
            </Text>
          </LinearGradient>
        </View>
      ) : null}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderWidth: 2,
    borderRadius: tokens.radius.lg,
    overflow: "hidden",
    minHeight: tokens.touchMin,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
  sheen: {
    ...StyleSheet.absoluteFillObject,
    opacity: 0.5,
  },
  titleRow: {
    paddingTop: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.md,
  },
  titleBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radius.pill,
  },
  title: {
    fontSize: tokens.typography.bodySm,
    letterSpacing: 1,
  },
  content: {
    padding: tokens.spacing.md,
  },
});
