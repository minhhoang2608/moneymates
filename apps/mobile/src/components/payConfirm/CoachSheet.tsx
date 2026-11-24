import { useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/PressableScale";

import { vi } from "@/i18n/vi";
import { colors, fontFamily, fontSize, radii } from "@/theme";

/** Mount it only while open. Explains how to use the saved QR in a non-autofill bank app. */
export function CoachSheet({
  bankName,
  onConfirm,
  onClose,
}: {
  bankName: string;
  onConfirm: (result: { dontShow: boolean }) => void;
  onClose: () => void;
}) {
  const [dontShow, setDontShow] = useState(false);
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      {/* bare-pressable-ok: modal backdrop, not a visual button */}
      <Pressable style={styles.backdrop} onPress={onClose} testID="coach-close" accessibilityLabel={vi.txn.close} />
      <View style={styles.sheet} testID="coach-sheet">
        <Text style={styles.text} testID="coach-text">
          {vi.coach.text(bankName)}
        </Text>
        <PressableScale
          testID="coach-dont-show"
          accessibilityRole="checkbox"
          accessibilityState={{ checked: dontShow }}
          onPress={() => setDontShow((v) => !v)}
          style={styles.check}
        >
          <View style={[styles.box, dontShow && styles.boxOn]}>
            {dontShow ? <Text style={styles.tick}>✓</Text> : null}
          </View>
          <Text style={styles.checkText}>{vi.coach.dontShow}</Text>
        </PressableScale>
        <PressableScale
          testID="coach-confirm"
          accessibilityRole="button"
          onPress={() => onConfirm({ dontShow })}
          style={styles.confirm}
        >
          <Text style={styles.confirmText}>{vi.coach.confirm(bankName)}</Text>
        </PressableScale>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: colors.border,
    gap: 16,
  },
  text: { fontFamily: fontFamily.semibold, fontSize: fontSize.row, color: colors.text },
  check: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  box: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: colors.onPrimary, fontSize: 14 },
  checkText: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.text },
  confirm: {
    height: 48,
    borderRadius: radii.button,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmText: { fontFamily: fontFamily.semibold, fontSize: fontSize.row, color: colors.onPrimary },
});
