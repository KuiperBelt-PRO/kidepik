import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";

import { ProceduralBackground } from "./ProceduralBackground";
import { RetroOverlay } from "./RetroOverlay";

type Props = {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function ThemeBackground({ children, style }: Props) {
  return (
    <View style={[styles.root, style]}>
      <ProceduralBackground />
      <RetroOverlay />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },
});
