import { StyleSheet, View } from "react-native";

import { colors } from "@/theme";

const corner = { position: "absolute", width: 44, height: 44, borderColor: colors.accent } as const;

export function ScanFrame() {
  return (
    <View style={styles.frame} pointerEvents="none">
      <View style={[corner, styles.tl]} />
      <View style={[corner, styles.tr]} />
      <View style={[corner, styles.bl]} />
      <View style={[corner, styles.br]} />
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: 280, height: 280 },
  tl: { left: 0, top: 0, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 16 },
  tr: { right: 0, top: 0, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 16 },
  bl: { left: 0, bottom: 0, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 16 },
  br: { right: 0, bottom: 0, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 16 },
  line: {
    position: "absolute",
    left: 24,
    right: 24,
    top: 132,
    height: 2,
    backgroundColor: colors.accent,
  },
});
