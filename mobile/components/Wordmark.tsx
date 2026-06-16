import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { useAppTheme } from "../theme";
import { useTypography } from "../theme/useTypography";
import { tokens } from "../theme/tokens";

type Props = {
  subtitle?: string;
};

export function Wordmark({ subtitle }: Props) {
  const { theme } = useAppTheme();
  const typo = useTypography();

  return (
    <View style={styles.wrap}>
      <Text
        style={[
          styles.logoShadow,
          {
            color: theme.palette.retroGlow,
            fontFamily: typo.display,
          },
        ]}
      >
        KidepiK
      </Text>
      <View style={styles.logoBox}>
        <LinearGradient
          colors={[theme.palette.secondary, theme.palette.primary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <Text
          style={[
            styles.logo,
            {
              fontFamily: typo.display,
              color:
                theme.id === "fantasy" ? theme.palette.onPrimary : "#FFFFFF",
            },
          ]}
        >
          KidepiK
        </Text>
      </View>
      {subtitle ? (
        <Text
          style={[
            styles.subtitle,
            {
              color: theme.palette.secondary,
              fontFamily: typo.body,
              textShadowColor: theme.palette.retroGlow,
              textShadowRadius: 8,
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
  logoShadow: {
    position: "absolute",
    fontSize: tokens.typography.logo,
    letterSpacing: 3,
    opacity: 0.45,
    transform: [{ translateY: 3 }],
  },
  logoBox: {
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.xs,
    borderRadius: tokens.radius.md,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    fontSize: tokens.typography.logo,
    letterSpacing: 3,
    textAlign: "center",
  },
  subtitle: {
    fontSize: tokens.typography.bodyLg,
    marginTop: tokens.spacing.md,
    textAlign: "center",
  },
});
