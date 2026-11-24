import { useEffect } from "react";
import Animated from "react-native-reanimated";
import { StyleSheet, Text } from "react-native";
import { PressableScale } from "@/components/PressableScale";

import { toastMotionProps, useReduceMotion } from "@/lib/motion";
import { vi } from "@/i18n/vi";
import { colors, fontFamily, fontSize, radii } from "@/theme";

const HIDE_AFTER_MS = 5000;

export function UndoSnackbar({
  token,
  onUndo,
  onHide,
}: {
  /** Changes with each deletion so the timer restarts. */
  token: string;
  onUndo: () => void;
  onHide: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onHide, HIDE_AFTER_MS);
    return () => clearTimeout(t);
  }, [token, onHide]);

  const motion = toastMotionProps(useReduceMotion());
  return (
    <Animated.View style={styles.bar} testID="undo-snackbar" {...motion}>
      <Text style={styles.text}>{vi.history.deleted}</Text>
      <PressableScale testID="undo" accessibilityRole="button" onPress={onUndo} hitSlop={8}>
        <Text style={styles.action}>{vi.history.undo}</Text>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 24,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderRadius: radii.input,
    backgroundColor: colors.text,
  },
  text: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.onPrimary },
  action: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.accent },
});
