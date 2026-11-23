import { StyleSheet, Text, View } from "react-native";

import { vi } from "@/i18n/vi";
import { colors, fontFamily, fontSize, layout } from "@/theme";

export function PlaceholderScreen({ title, testID }: { title: string; testID: string }) {
  return (
    <View style={styles.root} testID={testID}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{vi.comingSoon}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: layout.screenPadding,
    backgroundColor: colors.background,
  },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.heading, color: colors.text },
  text: {
    marginTop: 8,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
});
