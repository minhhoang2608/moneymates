import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { durations } from "@/lib/motion";
import { colors } from "@/theme";

const PULSE_MS = 700;

type Props = {
  /** True while the recognizer is listening. */
  active: boolean;
  reduceMotion: boolean;
  /** Latest input level 0..1; null when the recognizer has no level meter (steady pulse). */
  level: number | null;
};

/** Pulse rings around the mic. Static (highlighted border, no animation) with reduce motion. */
export function VoiceRings({ active, reduceMotion, level }: Props) {
  const scale = useSharedValue(1);
  const animate = active && !reduceMotion;
  const metered = level !== null;

  useEffect(() => {
    if (!animate) {
      cancelAnimation(scale);
      scale.set(withTiming(1, { duration: durations.fast }));
    } else if (!metered) {
      scale.set(
        withRepeat(withSequence(withTiming(1.25, { duration: PULSE_MS }), withTiming(1, { duration: PULSE_MS })), -1),
      );
    }
  }, [animate, metered, scale]);

  useEffect(() => {
    if (animate && level !== null) scale.set(withTiming(1 + level * 0.4, { duration: durations.fast }));
  }, [animate, level, scale]);

  const animated = useAnimatedStyle(() => ({
    opacity: 0.35,
    transform: [{ scale: scale.value }],
  }));

  if (!active) return null;
  if (reduceMotion) {
    return <Animated.View testID="voice-rings" pointerEvents="none" style={[styles.ring, styles.staticRing]} />;
  }
  return (
    <>
      <Animated.View testID="voice-rings" pointerEvents="none" style={[styles.ring, animated]} />
    </>
  );
}

const styles = StyleSheet.create({
  ring: {
    position: "absolute",
    width: 124,
    height: 124,
    borderRadius: 62,
    backgroundColor: colors.primarySoft2,
  },
  staticRing: { backgroundColor: "transparent", borderWidth: 3, borderColor: colors.primary },
});
