import { StyleSheet, Text, View } from "react-native";

import { GameButton } from "./GameButton";
import { GamePanel } from "./GamePanel";
import { useAppTheme } from "../theme";
import { tokens } from "../theme/tokens";

type Props = {
  question: string;
  answers: string[];
  hint?: string;
  showHint?: boolean;
  onAnswer?: (index: number) => void;
};

export function ChallengeCard({
  question,
  answers,
  hint,
  showHint,
  onAnswer,
}: Props) {
  const { theme } = useAppTheme();

  return (
    <GamePanel title="Reto">
      <Text
        style={[
          styles.question,
          {
            color: theme.palette.narrative,
            fontFamily: theme.typography.bodyFamily,
          },
        ]}
      >
        {question}
      </Text>
      <View style={styles.answers}>
        {answers.map((answer, index) => (
          <GameButton
            key={answer}
            label={answer}
            variant={index % 2 === 0 ? "primary" : "secondary"}
            onPress={() => onAnswer?.(index)}
            style={styles.answer}
          />
        ))}
      </View>
      {showHint && hint ? (
        <View
          style={[
            styles.hintBox,
            { backgroundColor: theme.palette.frameFill },
          ]}
        >
          <Text
            style={[
              styles.hintLabel,
              {
                color: theme.palette.hint,
                fontFamily: theme.typography.displayFamily,
              },
            ]}
          >
            {theme.labels.hintLabel}
          </Text>
          <Text
            style={[
              styles.hintText,
              {
                color: theme.palette.narrativeMuted,
                fontFamily: theme.typography.bodyFamily,
              },
            ]}
          >
            {hint}
          </Text>
        </View>
      ) : null}
    </GamePanel>
  );
}

const styles = StyleSheet.create({
  question: {
    fontSize: tokens.typography.bodyLg,
    lineHeight: 26,
    marginBottom: tokens.spacing.md,
  },
  answers: {
    gap: tokens.spacing.sm,
  },
  answer: {
    width: "100%",
  },
  hintBox: {
    marginTop: tokens.spacing.md,
    padding: tokens.spacing.md,
    borderRadius: tokens.radius.sm,
  },
  hintLabel: {
    fontSize: tokens.typography.bodySm,
    marginBottom: tokens.spacing.xs,
  },
  hintText: {
    fontSize: tokens.typography.body,
    lineHeight: 22,
  },
});
