import { useEffect } from "react";
import { StyleSheet, View, type DimensionValue } from "react-native";
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";

import { vi } from "@/i18n/vi";
import { durations, useReduceMotion } from "@/lib/motion";
import { colors, radii } from "@/theme";

type Props = { width?: DimensionValue; height?: number; radius?: number; testID?: string };

/** A neutral placeholder block with a subtle opacity pulse (static with reduce motion). */
export function Skeleton({ width = "100%", height = 16, radius = 8, testID }: Props) {
  const reduceMotion = useReduceMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reduceMotion) {
      cancelAnimation(opacity);
      opacity.set(1);
      return;
    }
    opacity.set(
      withRepeat(
        withSequence(withTiming(0.5, { duration: durations.slow }), withTiming(1, { duration: durations.slow })),
        -1,
      ),
    );
    return () => cancelAnimation(opacity);
  }, [reduceMotion, opacity]);

  const animated = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      testID={testID}
      accessible
      accessibilityLabel={vi.common.loading}
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.divider }, animated]}
    />
  );
}

/** `count` row-shaped placeholders for list screens. */
export function SkeletonList({ count = 4, testID }: { count?: number; testID?: string }) {
  return (
    <View testID={testID} style={styles.list}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={styles.row}>
          <Skeleton width={40} height={40} radius={radii.input} />
          <View style={styles.lines}>
            <Skeleton width="60%" height={14} />
            <Skeleton width="35%" height={12} />
          </View>
          <Skeleton width={64} height={14} />
        </View>
      ))}
    </View>
  );
}

/** A card-shaped placeholder for the overview screen. */
export function SkeletonCard({ testID }: { testID?: string }) {
  return (
    <View testID={testID} style={styles.card}>
      <Skeleton width="40%" height={14} />
      <Skeleton width="70%" height={32} radius={radii.input} />
      <View style={styles.tiles}>
        <Skeleton width="48%" height={56} radius={radii.input} />
        <Skeleton width="48%" height={56} radius={radii.input} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: 16, paddingTop: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  lines: { flex: 1, gap: 8 },
  card: { backgroundColor: colors.surface, borderRadius: radii.card, padding: 16, gap: 12 },
  tiles: { flexDirection: "row", justifyContent: "space-between" },
});
