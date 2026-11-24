import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useToast } from "@/stores/toast";
import { colors, fontFamily, fontSize, radii } from "@/theme";

export const TOAST_MS = 3000;

/** A small in-app toast driven by the toast store. Mount once in the root layout. */
export function Toast() {
  const text = useToast((s) => s.text);

  useEffect(() => {
    if (!text) return;
    const t = setTimeout(() => useToast.getState().hide(), TOAST_MS);
    return () => clearTimeout(t);
  }, [text]);

  if (!text) return null;
  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.bar} testID="handoff-coach-toast">
        <Text style={styles.text}>{text}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, bottom: 96 },
  bar: { backgroundColor: colors.text, borderRadius: radii.button, paddingHorizontal: 16, paddingVertical: 12 },
  text: { fontFamily: fontFamily.medium, fontSize: fontSize.secondary, color: colors.onPrimary },
});
