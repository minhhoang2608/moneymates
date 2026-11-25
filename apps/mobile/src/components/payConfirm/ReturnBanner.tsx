import { useEffect, useRef } from "react";
import Animated from "react-native-reanimated";
import { AppState, Platform, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { PressableScale } from "@/components/PressableScale";

import { HandOffQr, type QrRef } from "@/components/payConfirm/HandOffQr";
import { useRepositories } from "@/db/RepositoriesProvider";
import { vi } from "@/i18n/vi";
import { toastMotionProps, useReduceMotion } from "@/lib/motion";
import { formatVnd } from "@/lib/money";
import { makeHandOff } from "@/lib/payConfirm/handOffDeps";
import { startHandOff } from "@/lib/payConfirm/startHandOff";
import { useToast } from "@/stores/toast";
import { useQrCleanupOnReturn } from "@/lib/qrImage/useQrCleanupOnReturn";
import { usePendingHandOff } from "@/stores/pendingHandOff";
import { colors, fontFamily, fontSize, radii } from "@/theme";

export const HIDE_AFTER_MS = 6000;

/** Shown when the user comes back from the bank app: confirms the saved payment, with undo and "open again". */
export function ReturnBanner() {
  const { transactions, handOffs, handOffMemory, preferences } = useRepositories();
  const pending = usePendingHandOff((s) => s.pending);
  const visible = usePendingHandOff((s) => s.visible);
  const qrRef = useRef<QrRef | null>(null);
  useQrCleanupOnReturn();

  useEffect(() => {
    let sawBackground = false;
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "background" || state === "inactive") sawBackground = true;
      else if (state === "active" && sawBackground) {
        sawBackground = false;
        const handOffId = usePendingHandOff.getState().pending?.handOffId;
        if (handOffId) {
          handOffs.recordReturn(handOffId, new Date()).catch((e) => console.warn("could not record return", e));
        }
        usePendingHandOff.getState().reveal();
      }
    });
    return () => sub.remove();
  }, [handOffs]);

  useEffect(() => {
    if (!visible || !pending) return;
    const t = setTimeout(() => usePendingHandOff.getState().clear(), HIDE_AFTER_MS);
    return () => clearTimeout(t);
  }, [visible, pending]);

  const motion = toastMotionProps(useReduceMotion());

  if (!visible || !pending) return null;

  const remove = async () => {
    try {
      await transactions.softDelete(pending.txId);
      usePendingHandOff.getState().markDeleted();
    } catch {
      usePendingHandOff.getState().clear();
    }
  };

  const reopen = pending.reopen;
  const reopenApp = async () => {
    if (!reopen) return;
    try {
      const result = await startHandOff(
        {
          makeHandOff,
          handOffs,
          handOffMemory,
          record: {
            platform: Platform.OS === "android" ? "android" : "ios",
            preferences,
            showToast: useToast.getState().show,
            addOnlyMessage: vi.qrImage.addOnlyPermission,
          },
        },
        {
          app: reopen.app,
          model: reopen.model,
          amount: reopen.amount,
          note: reopen.note,
          txId: pending.txId,
          getQrBase64: () =>
            new Promise<string | null>((resolve) => {
              if (!qrRef.current) return resolve(null);
              qrRef.current.toDataURL((data) => resolve(data || null));
            }),
          onRow: (id) => usePendingHandOff.getState().setHandOffId(id),
        },
      );
      // Hidden while the bank app is in front; the next return shows it again.
      if (result.opened) usePendingHandOff.getState().hide();
    } catch (e) {
      console.warn("could not reopen bank app", e);
    }
  };

  return (
    <Animated.View style={styles.bar} testID="handoff-return-banner" {...motion}>
      <View style={styles.row}>
        <Text style={styles.text} numberOfLines={1}>
          {vi.handOff.saved(formatVnd(pending.amount), pending.label)}
        </Text>
        <PressableScale testID="handoff-undo" accessibilityRole="button" onPress={remove} hitSlop={8}>
          <Text style={styles.action}>{vi.handOff.undo}</Text>
        </PressableScale>
      </View>
      {pending.qrDeleted && !reopen?.qrInAlbum ? (
        <View style={[styles.row, styles.second]}>
          <Text style={styles.muted} testID="handoff-qr-deleted">
            {vi.qrImage.deletedOnReturn}
          </Text>
        </View>
      ) : null}
      {reopen ? (
        <View style={[styles.row, styles.second]}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none" accessibilityElementsHidden>
            <Path
              d="M5 12l5 5L20 7"
              stroke={colors.accent}
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          {reopen.qrInAlbum ? (
            <Text style={styles.muted} testID="handoff-qr-deleted">
              {vi.handOff.qrDeleted}
            </Text>
          ) : (
            <View style={styles.grow} />
          )}
          <PressableScale
            testID="handoff-reopen"
            accessibilityRole="button"
            onPress={() => void reopenApp()}
            hitSlop={8}
          >
            <Text style={styles.actionSmall}>{vi.handOff.reopen(reopen.app.name)}</Text>
          </PressableScale>
        </View>
      ) : null}
      {reopen ? (
        <HandOffQr model={reopen.model} amount={reopen.amount} note={reopen.note} getRef={(r) => (qrRef.current = r)} />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 96,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: radii.input,
    backgroundColor: colors.text,
  },
  row: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 12 },
  second: { gap: 8, borderTopWidth: 1, borderTopColor: colors.onDarkDivider },
  grow: { flex: 1 },
  text: { flex: 1, fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.onPrimary },
  muted: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.onDarkMuted },
  action: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.accent },
  actionSmall: { fontFamily: fontFamily.semibold, fontSize: fontSize.secondary, color: colors.accent },
});
