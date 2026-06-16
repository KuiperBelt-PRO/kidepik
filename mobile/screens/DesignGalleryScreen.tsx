import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { GameButton } from "../components/GameButton";
import { ThemeBackground } from "../components/ThemeBackground";
import { ThemeToggle } from "../components/ThemeToggle";
import { Wordmark } from "../components/Wordmark";
import { MOCKUP_CATALOG, type MockupId } from "../mockups/catalog";
import { useAppTheme } from "../theme";
import { tokens } from "../theme/tokens";

type Props = {
  onOpenMockup: (id: MockupId) => void;
  onOpenWorldPicker: () => void;
  onOpenPoc: () => void;
};

export function DesignGalleryScreen({
  onOpenMockup,
  onOpenWorldPicker,
  onOpenPoc,
}: Props) {
  const { theme } = useAppTheme();

  return (
    <ThemeBackground>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Wordmark subtitle="Galería de diseño" />
        <View style={styles.toggle}>
          <ThemeToggle />
        </View>
        <Text
          style={[
            styles.hint,
            {
              color: theme.palette.narrativeMuted,
              fontFamily: theme.typography.bodyFamily,
            },
          ]}
        >
          Tema activo: {theme.labels.worldName}. Cambia arriba para validar
          fantasía ↔ espacio.
        </Text>

        <Pressable
          onPress={onOpenWorldPicker}
          style={[
            styles.featured,
            { borderColor: theme.palette.surfaceBorder },
          ]}
        >
          <Text
            style={[
              styles.featuredTitle,
              {
                color: theme.palette.surface,
                fontFamily: theme.typography.displayFamily,
              },
            ]}
          >
            Selector de mundo
          </Text>
          <Text
            style={[
              styles.featuredDesc,
              {
                color: theme.palette.narrativeMuted,
                fontFamily: theme.typography.bodyFamily,
              },
            ]}
          >
            Pantalla completa de onboarding visual
          </Text>
        </Pressable>

        {MOCKUP_CATALOG.filter((m) => m.id !== "worldPicker").map((item) => (
          <Pressable
            key={item.id}
            onPress={() => onOpenMockup(item.id)}
            style={[
              styles.card,
              {
                backgroundColor: theme.palette.surface,
                borderColor: theme.palette.surfaceBorder,
              },
            ]}
          >
            <Text
              style={[
                styles.cardTitle,
                {
                  color: theme.palette.narrative,
                  fontFamily: theme.typography.displayFamily,
                },
              ]}
            >
              {item.title}
            </Text>
            <Text
              style={[
                styles.cardDesc,
                {
                  color: theme.palette.narrativeMuted,
                  fontFamily: theme.typography.bodyFamily,
                },
              ]}
            >
              {item.description}
            </Text>
          </Pressable>
        ))}

        <GameButton
          label="POC arquitectura (dev)"
          variant="ghost"
          onPress={onOpenPoc}
          style={styles.poc}
        />
      </ScrollView>
    </ThemeBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: tokens.spacing.md,
    paddingTop: tokens.spacing.xxl,
    paddingBottom: tokens.spacing.xxl,
  },
  toggle: {
    marginVertical: tokens.spacing.lg,
  },
  hint: {
    fontSize: tokens.typography.bodySm,
    textAlign: "center",
    marginBottom: tokens.spacing.lg,
    lineHeight: 20,
  },
  featured: {
    borderWidth: 2,
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
    marginBottom: tokens.spacing.md,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  featuredTitle: {
    fontSize: tokens.typography.title,
    marginBottom: tokens.spacing.xs,
  },
  featuredDesc: {
    fontSize: tokens.typography.bodySm,
  },
  card: {
    borderWidth: 2,
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    marginBottom: tokens.spacing.sm,
    minHeight: tokens.touchMin,
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: tokens.typography.bodyLg,
    marginBottom: tokens.spacing.xs,
  },
  cardDesc: {
    fontSize: tokens.typography.bodySm,
  },
  poc: {
    marginTop: tokens.spacing.lg,
  },
});
