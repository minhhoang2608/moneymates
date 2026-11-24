import { useMemo, useState } from "react";
import { Animated, PanResponder, StyleSheet, Text, View } from "react-native";

import { PaymentAppRow, ROW_HEIGHT } from "@/components/settings/PaymentAppRow";
import { vi } from "@/i18n/vi";
import type { PayApp } from "@/lib/payConfirm/apps";
import { moveItem, targetIndex } from "@/lib/preferences/reorder";
import { colors } from "@/theme";

type Props = {
  apps: PayApp[];
  onReorder: (ids: string[]) => void;
  onToggle: (id: string, on: boolean) => void;
};

function DraggableRow({
  app,
  index,
  count,
  onMove,
  onToggle,
}: {
  app: PayApp;
  index: number;
  count: number;
  onMove: (from: number, to: number) => void;
  onToggle: (id: string, on: boolean) => void;
}) {
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
      testID={`payment-app-drag-${app.id}`}
      accessibilityActions={[
        { name: "moveUp", label: vi.paymentApps.moveUp },
        { name: "moveDown", label: vi.paymentApps.moveDown },
      ]}
      onAccessibilityAction={(e) => {
        if (e.nativeEvent.actionName === "moveUp") onMove(index, index - 1);
        if (e.nativeEvent.actionName === "moveDown") onMove(index, index + 1);
      }}
      style={{ transform: [{ translateY: dy }] }}
    >
      <PaymentAppRow
        app={app}
        on
        last={index === count - 1}
        onToggle={(on) => onToggle(app.id, on)}
        handle={
          <View
            testID={`payment-app-handle-${app.id}`}
            accessibilityLabel={vi.paymentApps.drag}
            style={styles.handleBox}
            {...pan.panHandlers}
          >
            <Text style={styles.handle}>⋮⋮</Text>
          </View>
        }
      />
    </Animated.View>
  );
}

export function EnabledAppList({ apps, onReorder, onToggle }: Props) {
  const ids = apps.map((a) => a.id);
  const move = (from: number, to: number) => {
    const next = moveItem(ids, from, to);
    if (next.some((k, i) => k !== ids[i])) onReorder(next);
  };
  return (
    <View style={styles.card} testID="payment-apps-enabled-list">
      {apps.map((a, i) => (
        <DraggableRow key={a.id} app={a} index={i} count={apps.length} onMove={move} onToggle={onToggle} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 16, overflow: "hidden", paddingHorizontal: 14 },
  handleBox: { width: 14, height: 44, alignItems: "center", justifyContent: "center", marginRight: -4 },
  handle: { color: colors.neutral, fontSize: 16 },
});
