import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeInDown,
  FadeInUp,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";

import { ParticleField } from "../components/ParticleField";
import { ProgressRing } from "../components/ProgressRing";
import { ThemeBackground } from "../components/ThemeBackground";
import { Wordmark } from "../components/Wordmark";
import { useAppTheme } from "../theme";
import { useTypography } from "../theme/useTypography";
import { tokens } from "../theme/tokens";

const LOADER_PHRASES: Record<string, string[]> = {
  fantasy: [
    "Despertando las runas del bosque…",
    "Las luciérnagas doradas guían el camino…",
    "El reino verde te espera…",
  ],
  spaceOpera: [
    "Calibrando motores de curvatura…",
    "Sincronizando mapa estelar…",
    "Bienvenido a la flota azul…",
  ],
};

type Props = {
  onComplete: () => void;
};

export function LoaderScreen({ onComplete }: Props) {
  const { theme, themeId } = useAppTheme();
  const typo = useTypography();
  const progress = useSharedValue(0);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const [displayProgress, setDisplayProgress] = useState(0);

  const phrases = LOADER_PHRASES[themeId];

  useEffect(() => {
    progress.value = withTiming(1, { duration: tokens.loader.durationMs });
    const interval = setInterval(() => {
      setDisplayProgress((p) => Math.min(1, p + 0.05));
    }, tokens.loader.durationMs / 20);

    const phraseTimer = setInterval(() => {
      setPhraseIndex((i) => (i + 1) % phrases.length);
    }, 1200);

    const done = setTimeout(onComplete, tokens.loader.durationMs);

    return () => {
      clearInterval(interval);
      clearInterval(phraseTimer);
      clearTimeout(done);
    };
  }, [onComplete, phrases.length, progress]);

  return (
    <ThemeBackground>
      <ParticleField />
      <Pressable style={styles.container} onPress={onComplete}>
        <Animated.View entering={FadeInUp.duration(800)} style={styles.center}>
          <Wordmark subtitle={theme.labels.worldName} />
          <Animated.View entering={FadeInDown.delay(300).duration(700)} style={styles.ring}>
            <ProgressRing progress={displayProgress} />
          </Animated.View>
          <Animated.Text
            entering={FadeInDown.delay(500).duration(600)}
            style={[
              styles.phrase,
              {
                color: theme.palette.secondary,
                fontFamily: typo.body,
                textShadowColor: theme.palette.retroGlow,
                textShadowRadius: 10,
              },
            ]}
          >
            {phrases[phraseIndex]}
          </Animated.Text>
          <Text
            style={[
              styles.tapHint,
              {
                color: theme.palette.primary,
                fontFamily: typo.body,
              },
            ]}
          >
            Toca para saltar
          </Text>
        </Animated.View>
      </Pressable>
    </ThemeBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: tokens.spacing.lg,
  },
  center: {
    alignItems: "center",
    width: "100%",
  },
  ring: {
    marginVertical: tokens.spacing.xl,
  },
  phrase: {
    fontSize: tokens.typography.bodyLg,
    textAlign: "center",
    minHeight: 52,
    paddingHorizontal: tokens.spacing.md,
    fontWeight: "600",
  },
  tapHint: {
    fontSize: tokens.typography.bodySm,
    marginTop: tokens.spacing.xl,
    opacity: 0.75,
  },
});
