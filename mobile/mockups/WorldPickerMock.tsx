import { ScrollView, StyleSheet, Text, View } from "react-native";

import { GameButton } from "../components/GameButton";
import { GamePanel } from "../components/GamePanel";
import { ThemeBackground } from "../components/ThemeBackground";
import { useAppTheme } from "../theme";
import { tokens } from "../theme/tokens";

type Props = {
  onPickFantasy: () => void;
  onPickSpace: () => void;
};

/** ASSET_SLOT: worldCardFantasy / worldCardSpace */
export function WorldPickerMock({ onPickFantasy, onPickSpace }: Props) {
  const { theme } = useAppTheme();

  return (
    <ThemeBackground>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text
          style={[
            styles.heading,
            {
              color: theme.palette.surface,
              fontFamily: theme.typography.displayFamily,
            },
          ]}
        >
          Elige tu aventura
        </Text>
        <GamePanel title="Reinos Unidos" style={styles.card}>
          <Text
            style={[
              styles.blurb,
              {
                color: theme.palette.narrative,
                fontFamily: theme.typography.bodyFamily,
              },
            ]}
          >
            Magia, bosques encantados y artefactos perdidos. Restaura el
            equilibrio del reino.
          </Text>
          <GameButton label="Entrar al reino" onPress={onPickFantasy} />
        </GamePanel>
        <GamePanel title="Sector Alfa" style={styles.card}>
          <Text
            style={[
              styles.blurb,
              {
                color: theme.palette.narrative,
                fontFamily: theme.typography.bodyFamily,
              },
            ]}
          >
            Naves, nebulosas y academias espaciales. Recupera el conocimiento
            de la galaxia.
          </Text>
          <GameButton
            label="Despegar"
            variant="secondary"
            onPress={onPickSpace}
          />
        </GamePanel>
      </ScrollView>
    </ThemeBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: tokens.spacing.md,
    paddingTop: tokens.spacing.xxl,
    gap: tokens.spacing.md,
  },
  heading: {
    fontSize: tokens.typography.title,
    textAlign: "center",
    marginBottom: tokens.spacing.md,
  },
  card: {
    marginBottom: tokens.spacing.sm,
  },
  blurb: {
    fontSize: tokens.typography.body,
    lineHeight: 24,
    marginBottom: tokens.spacing.md,
  },
});
