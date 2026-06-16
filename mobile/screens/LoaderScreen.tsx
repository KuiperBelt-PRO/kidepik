import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  FadeIn,
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
    "Despertando las runas del reino…",
    "Preparando tu pergamino de aventuras…",
    "Los bosques susurran tu nombre…",
  ],
  spaceOpera: [
    "Calibrando motores de curvatura…",
    "Sincronizando mapa estelar…",
    "La Academia Espacial te espera…",
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
        <Animated.View entering={FadeIn.duration(600)} style={styles.center}>
          <Wordmark subtitle={theme.labels.worldName} />
          <View style={styles.ring}>
            <ProgressRing progress={displayProgress} />
          </View>
          <Text
            style={[
              styles.phrase,
              {
                color: theme.palette.surface,
                fontFamily: typo.body,
              },
            ]}
          >
            {phrases[phraseIndex]}
          </Text>
          <Text
            style={[
              styles.tapHint,
              {
                color: theme.palette.narrativeMuted,
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
  },
  tapHint: {
    fontSize: tokens.typography.bodySm,
    marginTop: tokens.spacing.xl,
    opacity: 0.6,
  },
});
