import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import { GameButton } from "./GameButton";
import { GamePanel } from "./GamePanel";
import { useAppTheme } from "../theme";
import { tokens } from "../theme/tokens";

type Props = {
  speaker?: string;
  text: string;
  onContinue?: () => void;
};

/** ASSET_SLOT: dialoguePortrait — retrato del narrador/personaje. */
function PortraitPlaceholder() {
  const { theme } = useAppTheme();

  return (
    <View
      style={[
        styles.portrait,
        { borderColor: theme.palette.surfaceBorder },
      ]}
    >
      <Svg width={56} height={56} viewBox="0 0 56 56">
        <Circle cx={28} cy={28} r={26} fill={theme.palette.primaryMuted} />
        <Circle cx={22} cy={24} r={4} fill={theme.palette.surface} />
        <Circle cx={34} cy={24} r={4} fill={theme.palette.surface} />
        <Path
          d="M20 36 Q28 42 36 36"
          stroke={theme.palette.surface}
          strokeWidth={2}
          fill="none"
        />
      </Svg>
    </View>
  );
}

export function DialogueBox({ speaker, text, onContinue }: Props) {
  const { theme } = useAppTheme();

  return (
    <GamePanel>
      <View style={styles.row}>
        <PortraitPlaceholder />
        <View style={styles.content}>
          {speaker ? (
            <Text
              style={[
                styles.speaker,
                {
                  color: theme.palette.primary,
                  fontFamily: theme.typography.displayFamily,
                },
              ]}
            >
              {speaker}
            </Text>
          ) : null}
          <Text
            style={[
              styles.text,
              {
                color: theme.palette.narrative,
                fontFamily: theme.typography.bodyFamily,
              },
            ]}
          >
            {text}
          </Text>
        </View>
      </View>
      {onContinue ? (
        <GameButton
          label={theme.labels.continueLabel}
          onPress={onContinue}
          style={styles.continue}
        />
      ) : null}
    </GamePanel>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: tokens.spacing.md,
  },
  portrait: {
    width: 64,
    height: 64,
    borderRadius: tokens.radius.sm,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.08)",
  },
  content: {
    flex: 1,
  },
  speaker: {
    fontSize: tokens.typography.bodySm,
    marginBottom: tokens.spacing.xs,
  },
  text: {
    fontSize: tokens.typography.bodyLg,
    lineHeight: 26,
  },
  continue: {
    marginTop: tokens.spacing.md,
  },
});
