import { StyleSheet, Text, View } from "react-native";

import { useAppTheme } from "../theme";
import { useTypography } from "../theme/useTypography";
import { tokens } from "../theme/tokens";

type Props = {
  subtitle?: string;
};

/** Wordmark tipográfico KidepiK — sin gimmicks visuales en las letras. */
export function Wordmark({ subtitle }: Props) {
  const { theme } = useAppTheme();
  const typo = useTypography();

  return (
    <View style={styles.wrap}>
      <Text
        style={[
          styles.logo,
          {
            color: theme.palette.surface,
            fontFamily: typo.display,
          },
        ]}
      >
        KidepiK
      </Text>
      {subtitle ? (
        <Text
          style={[
            styles.subtitle,
            {
              color: theme.palette.secondary,
              fontFamily: typo.body,
            },
          ]}
        >
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
  },
  logo: {
    fontSize: tokens.typography.logo,
    letterSpacing: 2,
  },
  subtitle: {
    fontSize: tokens.typography.body,
    marginTop: tokens.spacing.sm,
    textAlign: "center",
  },
});
