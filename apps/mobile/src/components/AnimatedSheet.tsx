import { useEffect, useState, type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, View } from "react-native";
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";

import { isE2E } from "@/e2e/isE2E";
import { durations, useReduceMotion } from "@/lib/motion";

export type AnimatedSheetVariant = "sheet" | "popup" | "fullscreen";

const OFFSCREEN = 600;
const BACKDROP = "rgba(17,24,39,0.4)";
const POPUP_BACKDROP = "rgba(17,24,39,0.6)";

/**
 * Modal wrapper with enter/exit motion: dimmed backdrop fade plus slide-up (sheet, fullscreen) or
 * fade + scale (popup). Callbacks are never delayed; the exit animation is purely visual.
 */
export function AnimatedSheet({
  visible,
  onClose,
  variant,
  testID,
  backdropLabel,
  backdropTestID,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  variant: AnimatedSheetVariant;
  testID?: string;
  backdropLabel?: string;
  backdropTestID?: string;
  children: ReactNode;
}) {
  const reduceMotion = useReduceMotion();
  const instantExit = reduceMotion || isE2E();
  const [mounted, setMounted] = useState(visible);
  const progress = useSharedValue(visible && reduceMotion ? 1 : 0);

  // Derive mount state during render (no setState in an effect).
  if (visible && !mounted) setMounted(true);
  if (!visible && mounted && instantExit) setMounted(false);
  const closing = !visible && mounted;

  useEffect(() => {
    if (visible) {
      progress.value = reduceMotion ? 1 : withTiming(1, { duration: durations.base });
    } else if (instantExit) {
      progress.value = 0;
    } else {
      progress.value = withTiming(0, { duration: durations.base }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const contentStyle = useAnimatedStyle(() => {
    const p = progress.value;
    if (variant === "popup") return { opacity: p, transform: [{ scale: 0.95 + 0.05 * p }] };
    return { transform: [{ translateY: (1 - p) * OFFSCREEN }] };
  });

  if (!visible && !mounted) return null;
  if (!visible && instantExit) return null;
  const fullscreen = variant === "fullscreen";
  const popup = variant === "popup";
  return (
    <Modal
      visible
      transparent={!fullscreen}
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent={!fullscreen}
    >
      {fullscreen ? null : (
        <Animated.View
          testID={testID ? `${testID}-backdrop` : undefined}
          style={[StyleSheet.absoluteFill, { backgroundColor: popup ? POPUP_BACKDROP : BACKDROP }, backdropStyle]}
        >
          {/* bare-pressable-ok: modal backdrop, not a visual button */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            testID={backdropTestID}
            accessibilityLabel={backdropLabel}
          />
        </Animated.View>
      )}
      <View
        style={[styles.layer, fullscreen ? null : popup ? styles.popup : styles.sheet]}
        pointerEvents={closing ? "none" : "box-none"}
      >
        <Animated.View style={[fullscreen ? styles.fill : null, contentStyle]} testID={testID}>
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

AnimatedSheet.displayName = "AnimatedSheet";

const styles = StyleSheet.create({
  layer: { flex: 1 },
  sheet: { justifyContent: "flex-end" },
  popup: { justifyContent: "center", padding: 20 },
  fill: { flex: 1 },
});
