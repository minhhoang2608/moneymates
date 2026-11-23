import { StyleSheet, Text, View } from "react-native";

import { vi } from "@/i18n/vi";
import { colors, fontFamily, fontSize, layout } from "@/theme";

export default function ScanScreen() {
  return (
    <View style={styles.root} testID="screen-scan">
      <Text style={styles.title}>{vi.scan.title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: layout.screenPadding,
    backgroundColor: colors.scannerBg,
  },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.heading, color: colors.onPrimary },
});
