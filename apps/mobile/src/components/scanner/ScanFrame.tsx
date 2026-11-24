import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { durations, useReduceMotion } from "@/lib/motion";
import { colors } from "@/theme";

const corner = { position: "absolute", width: 44, height: 44, borderColor: colors.accent } as const;

const SWEEP_MS = 1600;
const LINE_TOP = 16;
const LINE_BOTTOM = 262;
const LINE_CENTER = 132;
const FLASH_PEAK = 0.35;
const FLASH_FADE_MS = 250 - durations.press; // flash totals 250 ms

type Props = { detected?: boolean };

export function ScanFrame({ detected = false }: Props) {
  const reduceMotion = useReduceMotion();
  const animating = !reduceMotion && !detected;
  const lineY = useSharedValue(LINE_CENTER);
  const flash = useSharedValue(0);

  useEffect(() => {
    if (animating) {
      lineY.set(LINE_TOP);
      lineY.set(withRepeat(withTiming(LINE_BOTTOM, { duration: SWEEP_MS, easing: Easing.linear }), -1, true));
    } else {
      cancelAnimation(lineY);
      if (reduceMotion) lineY.set(LINE_CENTER);
    }
    return () => cancelAnimation(lineY);
  }, [animating, reduceMotion, lineY]);

  useEffect(() => {
    if (!detected) return;
    if (reduceMotion) {
      flash.set(FLASH_PEAK);
    } else {
      flash.set(
        withSequence(withTiming(FLASH_PEAK, { duration: durations.press }), withTiming(0, { duration: FLASH_FADE_MS })),
      );
    }
  }, [detected, reduceMotion, flash]);

  const lineStyle = useAnimatedStyle(() => ({ transform: [{ translateY: lineY.value }] }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  return (
    <View style={styles.frame} pointerEvents="none" testID="scan-frame">
      <View
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
        testID={animating ? "scan-frame-animated" : "scan-frame-static"}
      >
        {detected ? <Animated.View testID="scan-flash" style={[styles.flash, flashStyle]} /> : null}
        <View style={[corner, styles.tl]} />
        <View style={[corner, styles.tr]} />
        <View style={[corner, styles.bl]} />
        <View style={[corner, styles.br]} />
        <Animated.View testID="scan-line" style={[styles.line, lineStyle]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { width: 280, height: 280 },
  flash: { ...(StyleSheet.absoluteFill as object), borderRadius: 16, backgroundColor: colors.accent },
  tl: { left: 0, top: 0, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 16 },
  tr: { right: 0, top: 0, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 16 },
  bl: { left: 0, bottom: 0, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 16 },
  br: { right: 0, bottom: 0, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 16 },
  line: {
    position: "absolute",
    left: 24,
    right: 24,
    top: 0,
    height: 2,
    backgroundColor: colors.accent,
  },
});
