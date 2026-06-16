import { Pressable, StyleSheet, Text, View } from "react-native";

import { useAppTheme, type WorldThemeId } from "../theme";
import { tokens } from "../theme/tokens";

type Props = {
  compact?: boolean;
};

export function ThemeToggle({ compact }: Props) {
  const { themeId, setThemeId, theme } = useAppTheme();

  const options: { id: WorldThemeId; label: string }[] = [
    { id: "fantasy", label: "Fantasía" },
    { id: "spaceOpera", label: "Espacio" },
  ];

  return (
    <View style={[styles.row, compact && styles.compact]}>
      {options.map((opt) => {
        const active = themeId === opt.id;
        return (
          <Pressable
            key={opt.id}
            onPress={() => setThemeId(opt.id)}
            style={[
              styles.pill,
              {
                backgroundColor: active
                  ? theme.palette.primary
                  : theme.palette.frameFill,
                borderColor: theme.palette.surfaceBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.label,
                {
                  color: active ? theme.palette.surface : theme.palette.surface,
                  fontFamily: theme.typography.bodyFamily,
                  opacity: active ? 1 : 0.75,
                },
              ]}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
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
    transform: [{ scale: 0.9 }],
  },
  pill: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    minHeight: tokens.touchMin / 1.5,
    justifyContent: "center",
  },
  label: {
    fontSize: tokens.typography.bodySm,
  },
});
