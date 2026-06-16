import { StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../theme";
import { tokens } from "../theme/tokens";

type Props = {
  title?: string;
};

/** Contenedor placeholder para minijuegos táctiles futuros. */
export function MiniGameShell({ title = "Minijuego" }: Props) {
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        styles.shell,
        {
          borderColor: theme.palette.surfaceBorder,
          backgroundColor: theme.palette.frameFill,
        },
      ]}
    >
      <Text
        style={[
          styles.title,
          {
            color: theme.palette.surface,
            fontFamily: theme.typography.displayFamily,
          },
        ]}
      >
        {title}
      </Text>
      <View
        style={[
          styles.canvas,
          { borderColor: theme.palette.primaryMuted },
        ]}
      >
        <Text
          style={[
            styles.placeholder,
            {
              color: theme.palette.narrativeMuted,
              fontFamily: theme.typography.bodyFamily,
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
  },
  placeholder: {
    fontSize: tokens.typography.bodySm,
  },
});
