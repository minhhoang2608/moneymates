import { StyleSheet, Text, View } from "react-native";

import { colors, fontFamily, memberColors } from "@/theme";

/** Initial-letter avatar. `index` picks the colour; index 0 is "Tôi". */
export function Avatar({
  name,
  index,
  size,
  overlap = false,
}: {
  name: string;
  index: number;
  size: number;
  overlap?: boolean;
}) {
  return (
    <View
      style={[
        styles.root,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: memberColors[index % memberColors.length],
        },
        overlap && styles.overlap,
      ]}
    >
      <Text style={[styles.text, { fontSize: size > 30 ? 12 : 11 }]}>{(name.trim()[0] ?? "?").toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: "center", justifyContent: "center", borderWidth: 2, borderColor: colors.surface },
  overlap: { marginLeft: -8 },
  text: { fontFamily: fontFamily.bold, color: colors.onPrimary },
});
