import { ScrollView, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import Svg, { Circle, Path, Rect } from "react-native-svg";

import { GameButton } from "../components/GameButton";
import { GamePanel } from "../components/GamePanel";
import { ThemeBackground } from "../components/ThemeBackground";
import { Wordmark } from "../components/Wordmark";
import { useAppTheme } from "../theme";
import { useTypography } from "../theme/useTypography";
import { tokens } from "../theme/tokens";

type Props = {
  onPickFantasy: () => void;
  onPickSpace: () => void;
};

function FantasyEmblem() {
  const { theme } = useAppTheme();
  return (
    <Svg width={72} height={72} viewBox="0 0 72 72">
      <Circle cx={36} cy={36} r={34} fill={theme.palette.frameFill} />
      <Path
        d="M36 12 L42 28 L58 28 L46 38 L50 54 L36 44 L22 54 L26 38 L14 28 L30 28 Z"
        fill={theme.palette.secondary}
        stroke={theme.palette.primary}
        strokeWidth={2}
      />
      <Circle cx={36} cy={36} r={8} fill={theme.palette.primary} opacity={0.6} />
    </Svg>
  );
}

function SpaceEmblem() {
  const { theme } = useAppTheme();
  return (
    <Svg width={72} height={72} viewBox="0 0 72 72">
      <Circle cx={36} cy={36} r={34} fill={theme.palette.frameFill} />
      <Path
        d="M20 48 L52 48 L48 24 L24 24 Z"
        fill={theme.palette.primary}
        stroke={theme.palette.secondary}
        strokeWidth={2}
      />
      <Rect x={30} y={18} width={12} height={10} rx={2} fill={theme.palette.secondary} />
      <Circle cx={28} cy={52} r={3} fill={theme.palette.secondary} />
      <Circle cx={44} cy={52} r={3} fill={theme.palette.secondary} />
    </Svg>
  );
}

/** ASSET_SLOT: worldCardFantasy / worldCardSpace */
export function WorldPickerMock({ onPickFantasy, onPickSpace }: Props) {
  const { theme } = useAppTheme();
  const typo = useTypography();

  return (
    <ThemeBackground>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Animated.View entering={FadeInDown.duration(600)}>
          <Wordmark subtitle="Elige tu aventura" />
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(500)}>
          <GamePanel title="Reinos Unidos" style={styles.card}>
            <LinearGradient
              colors={["#2ECC71", "#F0C14A"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.banner}
            >
              <FantasyEmblem />
            </LinearGradient>
            <Text
              style={[
                styles.blurb,
                {
                  color: theme.palette.narrative,
                  fontFamily: typo.body,
                },
              ]}
            >
              Magia, bosques encantados y artefactos perdidos. Restaura el
              equilibrio del reino verde.
            </Text>
            <GameButton label="Entrar al reino" onPress={onPickFantasy} />
          </GamePanel>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(240).duration(500)}>
          <GamePanel title="Sector Alfa" style={styles.card}>
            <LinearGradient
              colors={["#1565C0", "#FFFFFF"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.banner}
            >
              <SpaceEmblem />
            </LinearGradient>
            <Text
              style={[
                styles.blurb,
                {
                  color: theme.palette.narrative,
                  fontFamily: typo.body,
                },
              ]}
            >
              Naves, nebulosas y academias espaciales. Recupera el conocimiento
              de la galaxia azul.
            </Text>
            <GameButton
              label="Despegar"
              variant="secondary"
              onPress={onPickSpace}
            />
          </GamePanel>
        </Animated.View>

        <Text
          style={[
            styles.footnote,
            {
              color: theme.palette.secondary,
              fontFamily: typo.body,
            },
          ]}
        >
          Puedes cambiar de mundo en cualquier momento desde la galería.
        </Text>
      </ScrollView>
    </ThemeBackground>
  );
}

const styles = StyleSheet.create({
  scroll: {
    padding: tokens.spacing.md,
    paddingTop: tokens.spacing.xxl,
    gap: tokens.spacing.md,
    paddingBottom: tokens.spacing.xxl,
  },
  card: {
    marginBottom: tokens.spacing.sm,
  },
  banner: {
    borderRadius: tokens.radius.md,
    padding: tokens.spacing.md,
    alignItems: "center",
    marginBottom: tokens.spacing.md,
  },
  blurb: {
    fontSize: tokens.typography.body,
    lineHeight: 24,
    marginBottom: tokens.spacing.md,
  },
  footnote: {
    fontSize: tokens.typography.bodySm,
    textAlign: "center",
    opacity: 0.85,
    marginTop: tokens.spacing.sm,
  },
});
