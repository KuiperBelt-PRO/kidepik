import { useState, type ReactNode } from "react";
import {
  LayoutChangeEvent,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { FrameCorners } from "./FrameCorners";
import { useAppTheme } from "../theme";
import { tokens } from "../theme/tokens";

type Props = {
  children: ReactNode;
  title?: string;
  style?: StyleProp<ViewStyle>;
};

/** Marco estilo aventura gráfica para paneles de contenido. */
export function GamePanel({ children, title, style }: Props) {
  const { theme } = useAppTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setSize({ width, height });
  };

  return (
    <View
      style={[
        styles.panel,
        {
          backgroundColor: theme.palette.surface,
          borderColor: theme.palette.surfaceBorder,
        },
        style,
      ]}
      onLayout={onLayout}
    >
      {size.width > 0 ? (
        <FrameCorners width={size.width} height={size.height} />
      ) : null}
      {title ? (
        <Text
          style={[
            styles.title,
            {
              color: theme.palette.narrative,
              fontFamily: theme.typography.displayFamily,
            },
          ]}
        >
          {title}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: tokens.frame.borderWidth,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    overflow: "hidden",
    minHeight: tokens.touchMin,
  },
  title: {
    fontSize: tokens.typography.title,
    marginBottom: tokens.spacing.sm,
  },
});
