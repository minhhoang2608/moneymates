import { useMemo, useState } from "react";
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";

import { vi } from "@/i18n/vi";
import { PAY_APPS } from "@/lib/payConfirm/apps";
import { moveItem, targetIndex } from "@/lib/preferences/reorder";
import { colors, fontFamily, fontSize, radii } from "@/theme";

export const ROW_HEIGHT = 52;

type Props = { order: string[]; onChange: (keys: string[]) => void };

function Row({
  id,
  index,
  count,
  last,
  onMove,
}: {
  id: string;
  index: number;
  count: number;
  last: boolean;
  onMove: (from: number, to: number) => void;
}) {
  const app = PAY_APPS.find((a) => a.id === id)!;
  const [dy] = useState(() => new Animated.Value(0));

  const pan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderMove: (_e, g) => dy.setValue(g.dy),
        onPanResponderRelease: (_e, g) => {
          dy.setValue(0);
          const to = targetIndex(index, g.dy, ROW_HEIGHT, count);
          if (to !== index) onMove(index, to);
        },
        onPanResponderTerminate: () => dy.setValue(0),
      }),
    [dy, index, count, onMove],
  );

  return (
    <Animated.View
      testID={`settings-app-row-${id}`}
      accessible
      accessibilityLabel={app.name}
      accessibilityActions={[
        { name: "moveUp", label: vi.settings.moveUp },
        { name: "moveDown", label: vi.settings.moveDown },
      ]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "moveUp") onMove(index, index - 1);
        if (e.nativeEvent.actionName === "moveDown") onMove(index, index + 1);
      }}
      style={[styles.row, !last && styles.rowBorder, { transform: [{ translateY: dy }] }]}
    >
      <View
        testID={`settings-app-handle-${id}`}
        accessibilityLabel={vi.settings.drag}
        style={styles.handleBox}
        {...pan.panHandlers}
      >
        <Text style={styles.handle}>⋮⋮</Text>
      </View>
      <Text style={styles.name}>{app.name}</Text>
      <Text style={[styles.mode, app.supportsAutofill && styles.modeAuto]}>
        {app.supportsAutofill ? vi.settings.autofill : vi.settings.scanQr}
      </Text>
      <Pressable
        testID={`settings-app-up-${id}`}
        accessibilityRole="button"
        accessibilityLabel={`${vi.settings.moveUp} ${app.name}`}
        disabled={index === 0}
        onPress={() => onMove(index, index - 1)}
        style={[styles.arrow, index === 0 && styles.arrowOff]}
      >
        <Text style={styles.arrowText}>▲</Text>
      </Pressable>
      <Pressable
        testID={`settings-app-down-${id}`}
        accessibilityRole="button"
        accessibilityLabel={`${vi.settings.moveDown} ${app.name}`}
        disabled={index === count - 1}
        onPress={() => onMove(index, index + 1)}
        style={[styles.arrow, index === count - 1 && styles.arrowOff]}
      >
        <Text style={styles.arrowText}>▼</Text>
      </Pressable>
    </Animated.View>
  );
}

export function PaymentAppList({ order: rawOrder, onChange }: Props) {
  const order = rawOrder.filter((id) => PAY_APPS.some((a) => a.id === id));
  function move(from: number, to: number) {
    const next = moveItem(order, from, to);
    if (next.some((k, i) => k !== order[i])) onChange(next);
  }
  return (
    <View style={styles.card} testID="settings-app-list">
      {order.map((id, i) => (
        <Row key={id} id={id} index={i} count={order.length} last={i === order.length - 1} onMove={move} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radii.card, paddingHorizontal: 16 },
  row: { minHeight: ROW_HEIGHT, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surface },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  handleBox: { width: 32, height: 44, alignItems: "center", justifyContent: "center" },
  handle: { color: colors.neutral, fontSize: 16 },
  name: { flex: 1, fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.text },
  mode: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
  modeAuto: { color: colors.primaryDark },
  arrow: { width: 28, height: 44, alignItems: "center", justifyContent: "center" },
  arrowOff: { opacity: 0.3 },
  arrowText: { fontSize: 11, color: colors.textMuted },
});
