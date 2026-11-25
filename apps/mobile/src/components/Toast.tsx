import { useEffect } from "react";
import Animated from "react-native-reanimated";
import { StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/components/PressableScale";

import { isE2E } from "@/e2e/isE2E";
import { toastMotionProps, useReduceMotion } from "@/lib/motion";
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
  const action = useToast((s) => s.action);
  const motion = toastMotionProps(useReduceMotion());

  useEffect(() => {
    if (!text) return;
    const t = setTimeout(() => useToast.getState().hide(), toastDuration());
    return () => clearTimeout(t);
  }, [text]);

  if (!text) return null;
  return (
    <View style={styles.wrap} pointerEvents={action ? "box-none" : "none"}>
      <Animated.View
        {...motion}
        style={styles.bar}
        testID="app-toast"
        accessible
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        <Text style={styles.text}>{text}</Text>
        {action ? (
          <PressableScale
            testID="app-toast-action"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => {
              useToast.getState().hide();
              action.onPress();
            }}
          >
            <Text style={styles.action}>{action.label}</Text>
          </PressableScale>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 16, right: 16, bottom: 96 },
  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.text,
    borderRadius: radii.button,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  text: { flex: 1, fontFamily: fontFamily.medium, fontSize: fontSize.secondary, color: colors.onPrimary },
  action: { fontFamily: fontFamily.semibold, fontSize: fontSize.secondary, color: colors.accent },
});
