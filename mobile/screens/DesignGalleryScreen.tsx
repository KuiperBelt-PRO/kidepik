import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";

import { GameButton } from "../components/GameButton";
import { ThemeBackground } from "../components/ThemeBackground";
import { ThemeToggle } from "../components/ThemeToggle";
import { Wordmark } from "../components/Wordmark";
import { MOCKUP_CATALOG, type MockupId } from "../mockups/catalog";
import { useAppTheme } from "../theme";
import { useTypography } from "../theme/useTypography";
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
  const typo = useTypography();

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
              color: theme.palette.secondary,
              fontFamily: typo.body,
            },
          ]}
        >
          Tema: {theme.labels.worldName} — cambia arriba para validar el look.
        </Text>

        <Pressable onPress={onOpenWorldPicker}>
          <LinearGradient
            colors={[theme.palette.primary, theme.palette.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.featured}
          >
            <Text
              style={[
                styles.featuredTitle,
                {
                  color: theme.palette.onPrimary,
                  fontFamily: typo.display,
                },
              ]}
            >
              Selector de mundo
            </Text>
            <Text
              style={[
                styles.featuredDesc,
                {
                  color: theme.palette.onPrimary,
                  fontFamily: typo.body,
                  opacity: 0.85,
                },
              ]}
            >
              Pantalla completa de onboarding visual
            </Text>
          </LinearGradient>
        </Pressable>

        {MOCKUP_CATALOG.filter((m) => m.id !== "worldPicker").map((item, i) => (
          <Animated.View key={item.id} entering={FadeInDown.delay(80 * i).duration(400)}>
            <Pressable onPress={() => onOpenMockup(item.id)}>
              <View
                style={[
                  styles.card,
                  {
                    borderColor: theme.palette.surfaceBorder,
                    shadowColor: theme.palette.retroGlow,
                  },
                ]}
              >
                <LinearGradient
                  colors={[
                    theme.palette.surface,
                    theme.id === "fantasy"
                      ? "rgba(230, 255, 240, 0.95)"
                      : "rgba(230, 245, 255, 0.95)",
                  ]}
                  style={StyleSheet.absoluteFill}
                />
                <Text
                  style={[
                    styles.cardTitle,
                    {
                      color: theme.palette.narrative,
                      fontFamily: typo.display,
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
                      fontFamily: typo.body,
                    },
                  ]}
                >
                  {item.description}
                </Text>
              </View>
            </Pressable>
          </Animated.View>
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
    borderRadius: tokens.radius.lg,
    padding: tokens.spacing.lg,
    marginBottom: tokens.spacing.md,
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
    overflow: "hidden",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
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
