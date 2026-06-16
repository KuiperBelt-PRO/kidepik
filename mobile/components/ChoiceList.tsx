import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { GameButton } from "./GameButton";
import { useAppTheme } from "../theme";
import { useTypography } from "../theme/useTypography";
import { tokens } from "../theme/tokens";

type Props = {
  choices: string[];
  onSelect?: (index: number) => void;
};

export function ChoiceList({ choices, onSelect }: Props) {
  const { theme } = useAppTheme();
  const typo = useTypography();

  return (
    <View style={styles.list}>
      <LinearGradient
        colors={[theme.palette.primary, theme.palette.secondary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.promptBar}
      >
        <Text
          style={[
            styles.prompt,
            {
              color: theme.palette.onPrimary,
              fontFamily: typo.display,
            },
          ]}
        >
          ¿Qué camino eliges?
        </Text>
      </LinearGradient>
      {choices.map((choice, index) => (
        <GameButton
          key={choice}
          label={choice}
          variant={index === 0 ? "primary" : "ghost"}
          onPress={() => onSelect?.(index)}
          style={styles.choice}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: tokens.spacing.sm,
  },
  promptBar: {
    borderRadius: tokens.radius.pill,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.sm,
    marginBottom: tokens.spacing.xs,
  },
  prompt: {
    fontSize: tokens.typography.bodySm,
    textAlign: "center",
    letterSpacing: 0.5,
  },
  choice: {
    width: "100%",
  },
});
