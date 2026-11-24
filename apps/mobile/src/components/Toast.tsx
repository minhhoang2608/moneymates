import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";

import { isE2E } from "@/e2e/isE2E";
import { useToast } from "@/stores/toast";
import { colors, fontFamily, fontSize, radii } from "@/theme";

export const TOAST_MS = 3000;
/** Longer in E2E so Maestro (which waits for the screen to settle before polling) can still see it. */
export const E2E_TOAST_MS = 10000;

export function toastDuration(): number {
  return isE2E() ? E2E_TOAST_MS : TOAST_MS;
}

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
      <View
        style={styles.bar}
        testID="handoff-coach-toast"
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
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
