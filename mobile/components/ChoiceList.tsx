import { StyleSheet, Text, View } from "react-native";

import { GameButton } from "./GameButton";
import { useAppTheme } from "../theme";
import { tokens } from "../theme/tokens";

type Props = {
  choices: string[];
  onSelect?: (index: number) => void;
};

export function ChoiceList({ choices, onSelect }: Props) {
  const { theme } = useAppTheme();

  return (
    <View style={styles.list}>
      <Text
        style={[
          styles.prompt,
          {
            color: theme.palette.narrativeMuted,
            fontFamily: theme.typography.bodyFamily,
          },
        ]}
      >
        ¿Qué camino eliges?
      </Text>
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
  prompt: {
    fontSize: tokens.typography.bodySm,
    marginBottom: tokens.spacing.xs,
  },
  choice: {
    width: "100%",
  },
});
