import { useState } from "react";
import { Pressable, StyleSheet, type PressableProps, type StyleProp, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { durations, pressOpacity, pressScale, useReduceMotion } from "@/lib/motion";

type Props = Omit<PressableProps, "style"> & { style?: StyleProp<ViewStyle> };

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PressableScale({ style, onPressIn, onPressOut, children, ...rest }: Props) {
  const reduceMotion = useReduceMotion();
  const [pressed, setPressed] = useState(false);
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);
  // Keep the caller's resting opacity (disabled/muted looks) and multiply the pressed dimming into it.
  const baseOpacity = StyleSheet.flatten(style)?.opacity ?? 1;

  const animated = useAnimatedStyle(() => ({
    opacity: baseOpacity * opacity.value,
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e) => {
        setPressed(true);
        opacity.set(withTiming(pressOpacity, { duration: durations.press }));
        if (!reduceMotion) scale.set(withTiming(pressScale, { duration: durations.press }));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        setPressed(false);
        opacity.set(withTiming(1, { duration: durations.press }));
        scale.set(withTiming(1, { duration: durations.press }));
        onPressOut?.(e);
      }}
      style={[style, animated, { opacity: baseOpacity * (pressed ? pressOpacity : 1) }]}
    >
      {children}
    </AnimatedPressable>
  );
}
