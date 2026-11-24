import { useEffect } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/PressableScale";

import { useRepositories } from "@/db/RepositoriesProvider";
import { vi } from "@/i18n/vi";
import { formatVnd } from "@/lib/money";
import { usePendingHandOff } from "@/stores/pendingHandOff";
import { colors, fontFamily, fontSize, radii } from "@/theme";

const HIDE_AFTER_MS = 8000;

/** Shown when the user comes back from the bank app: confirms the saved payment, with quick delete. */
export function ReturnBanner() {
  const { transactions, handOffMemory } = useRepositories();
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
    if (!visible || !pending || pending.askPaid) return;
    const t = setTimeout(() => usePendingHandOff.getState().clear(), HIDE_AFTER_MS);
    return () => clearTimeout(t);
  }, [visible, pending]);

  const answer = async (worked: boolean) => {
    const appId = pending?.appId;
    usePendingHandOff.getState().answerPaid();
    if (!appId) return;
    try {
      await handOffMemory.setShareResult(appId, worked);
    } catch (e) {
      console.warn("could not remember share result", e);
    }
  };

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
      <View style={styles.body}>
        <Text style={styles.text} numberOfLines={1}>
          {vi.handOff.saved(formatVnd(pending.amount), pending.label)}
        </Text>
        {pending.qrHint ? (
          <Text style={styles.hint} testID="handoff-qr-hint">
            {vi.handOff.qrHint}
          </Text>
        ) : null}
        {pending.askPaid ? (
          <View style={styles.ask} testID="handoff-ask-paid">
            <Text style={styles.text}>{vi.handOff.askPaid}</Text>
            <PressableScale
              testID="handoff-paid-yes"
              accessibilityRole="button"
              onPress={() => void answer(true)}
              hitSlop={8}
            >
              <Text style={styles.action}>{vi.handOff.paidYes}</Text>
            </PressableScale>
            <PressableScale
              testID="handoff-paid-no"
              accessibilityRole="button"
              onPress={() => void answer(false)}
              hitSlop={8}
            >
              <Text style={styles.action}>{vi.handOff.paidNo}</Text>
            </PressableScale>
          </View>
        ) : null}
      </View>
      <PressableScale testID="handoff-delete" accessibilityRole="button" onPress={remove} hitSlop={8}>
        <Text style={styles.action}>{vi.handOff.delete}</Text>
      </PressableScale>
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
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: radii.input,
    backgroundColor: colors.text,
  },
  body: { flex: 1 },
  ask: { flexDirection: "row", alignItems: "center", gap: 12 },
  text: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.onPrimary },
  hint: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.onPrimary },
  action: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.accent },
});
