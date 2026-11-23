import { useEffect } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";

import { useRepositories } from "@/db/RepositoriesProvider";
import { vi } from "@/i18n/vi";
import { formatVnd } from "@/lib/money";
import { usePendingHandOff } from "@/stores/pendingHandOff";
import { colors, fontFamily, fontSize, radii } from "@/theme";

const HIDE_AFTER_MS = 6000;

/** Shown when the user comes back from the bank app: confirms the saved payment, with quick delete. */
export function ReturnBanner() {
  const { transactions } = useRepositories();
  const pending = usePendingHandOff((s) => s.pending);
  const visible = usePendingHandOff((s) => s.visible);

  useEffect(() => {
    let sawBackground = false;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") sawBackground = true;
      else if (state === "active" && sawBackground) {
        sawBackground = false;
        usePendingHandOff.getState().reveal();
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!visible || !pending) return;
    const t = setTimeout(() => usePendingHandOff.getState().clear(), HIDE_AFTER_MS);
    return () => clearTimeout(t);
  }, [visible, pending]);

  if (!visible || !pending) return null;

  const remove = async () => {
    try {
      await transactions.softDelete(pending.txId);
      usePendingHandOff.getState().markDeleted();
    } catch {
      usePendingHandOff.getState().clear();
    }
  };

  return (
    <View style={styles.bar} testID="handoff-return-banner">
      <Text style={styles.text} numberOfLines={1}>
        {vi.handOff.saved(formatVnd(pending.amount), pending.label)}
      </Text>
      <Pressable testID="handoff-delete" accessibilityRole="button" onPress={remove} hitSlop={8}>
        <Text style={styles.action}>{vi.handOff.delete}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 96,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    borderRadius: radii.input,
    backgroundColor: colors.text,
  },
  text: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.onPrimary },
  action: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.accent },
});
