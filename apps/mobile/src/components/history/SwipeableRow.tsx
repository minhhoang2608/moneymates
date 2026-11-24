import { useEffect, useRef, useState, type ReactNode } from "react";
import { Animated, PanResponder, StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/PressableScale";

import { vi } from "@/i18n/vi";
import { colors, fontFamily, fontSize } from "@/theme";

const ACTION_WIDTH = 88;
const FULL_SWIPE = 200;

/** Swipe left to reveal a red "Xóa" button; a full swipe or a tap on it calls `onDelete`. */
export function SwipeableRow({ id, onDelete, children }: { id: string; onDelete: () => void; children: ReactNode }) {
  // Mutable state lives in a plain object created once, so gesture callbacks can read it.
  const [st] = useState(() => ({ x: new Animated.Value(0), open: false }));
  const deleteRef = useRef(onDelete);
  useEffect(() => {
    deleteRef.current = onDelete;
  });

  // Handlers only read refs inside gesture callbacks, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() => {
    const snap = (to: number) => {
      st.open = to !== 0;
      Animated.timing(st.x, { toValue: to, duration: 150, useNativeDriver: true }).start();
    };
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderMove: (_e, g) => {
        st.x.setValue(Math.min(0, (st.open ? -ACTION_WIDTH : 0) + g.dx));
      },
      onPanResponderRelease: (_e, g) => {
        const pos = (st.open ? -ACTION_WIDTH : 0) + g.dx;
        if (pos < -FULL_SWIPE) {
          snap(0);
          deleteRef.current();
        } else snap(pos < -ACTION_WIDTH / 2 ? -ACTION_WIDTH : 0);
      },
      onPanResponderTerminate: () => snap(st.open ? -ACTION_WIDTH : 0),
    });
  });
  const x = st.x;

  return (
    <View
      accessible
      accessibilityActions={[{ name: "delete", label: vi.history.delete }]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "delete") deleteRef.current();
      }}
    >
      <PressableScale
        testID={`history-delete-${id}`}
        accessibilityRole="button"
        accessibilityLabel={vi.history.delete}
        onPress={() => deleteRef.current()}
        style={styles.action}
      >
        <Text style={styles.actionText}>{vi.history.delete}</Text>
      </PressableScale>
      <Animated.View style={{ transform: [{ translateX: x }] }} {...pan.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  action: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: ACTION_WIDTH,
    backgroundColor: colors.expense,
    alignItems: "center",
    justifyContent: "center",
  },
  actionText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.onPrimary },
});
