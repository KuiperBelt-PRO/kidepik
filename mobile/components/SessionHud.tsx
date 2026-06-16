import { StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../theme";
import { tokens } from "../theme/tokens";

type Props = {
  subject: string;
  zone: string;
  progress: number;
};

/** HUD de sesión sin puntuación agresiva. */
export function SessionHud({ subject, zone, progress }: Props) {
  const { theme } = useAppTheme();
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <View
      style={[
        styles.hud,
        {
          borderColor: theme.palette.surfaceBorder,
          backgroundColor: theme.palette.overlay,
        },
      ]}
    >
      <View style={styles.row}>
        <Text
          style={[
            styles.subject,
            {
              color: theme.palette.surface,
              fontFamily: theme.typography.displayFamily,
            },
          ]}
        >
          {subject}
        </Text>
        <Text
          style={[
            styles.zone,
            {
              color: theme.palette.secondary,
              fontFamily: theme.typography.bodyFamily,
            },
          ]}
        >
          {zone}
        </Text>
      </View>
      <View style={[styles.track, { backgroundColor: theme.palette.frameFill }]}>
        <View
          style={[
            styles.fill,
            {
              width: `${clamped}%`,
              backgroundColor: theme.palette.primary,
            },
          ]}
        />
      </View>
      <Text
        style={[
          styles.unit,
          {
            color: theme.palette.narrativeMuted,
            fontFamily: theme.typography.bodyFamily,
          },
        ]}
      >
        {theme.labels.progressUnit} · {clamped}%
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hud: {
    borderWidth: 1,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: tokens.spacing.sm,
  },
  subject: {
    fontSize: tokens.typography.body,
  },
  zone: {
    fontSize: tokens.typography.bodySm,
  },
  track: {
    height: 8,
    borderRadius: tokens.radius.pill,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: tokens.radius.pill,
  },
  unit: {
    fontSize: 11,
    marginTop: tokens.spacing.xs,
  },
});
