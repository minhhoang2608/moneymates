import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AnimatedSheet } from "@/components/AnimatedSheet";
import { PressableScale } from "@/components/PressableScale";

import { useAiAvailable, useRefreshFeatures } from "@/api/features";
import { vi } from "@/i18n/vi";
import { colors, fontFamily, fontSize, radii } from "@/theme";

/** Action sheet for adding a transaction. Voice and bill capture arrive in later tickets. */
export function EntryMenu({
  visible,
  onManual,
  onClose,
  onVoice,
  onBill,
}: {
  visible: boolean;
  onManual: () => void;
  onClose: () => void;
  onVoice?: () => void;
  onBill?: () => void;
}) {
  const refreshFeatures = useRefreshFeatures();
  const bill = useAiAvailable("parse_bill");
  useEffect(() => {
    if (visible) refreshFeatures();
  }, [visible, refreshFeatures]);
  const voiceAi = useAiAvailable("parse_text").available;
  const billAi = bill.available;
  // Voice also works offline (rules only), so it is never gated on AI; bill capture needs the AI.
  // Chụp bill is never greyed out for good: while the AI is not confirmed available, a tap re-checks the server
  // and the row says why (a disabled button on a phone gave no clue and no way to retry).
  const billHint = billAi
    ? null
    : bill.reason === "loading"
      ? vi.entryMenu.billChecking
      : bill.reason === "disabled"
        ? vi.entryMenu.billDisabled
        : vi.entryMenu.billRetry(
            vi.apiErrors[bill.errorCode === "unknown" || !bill.errorCode ? "network" : bill.errorCode],
            bill.errorCode ?? "?",
          );
  const onBillPress = onBill ? (billAi ? onBill : () => refreshFeatures(true)) : undefined;
  const aiItems: [string, string, (() => void) | undefined, boolean, string | null][] = [
    ["entry-menu-voice", vi.entryMenu.voice, onVoice, true, voiceAi ? null : vi.voice.offlineHint],
    ["entry-menu-bill", vi.entryMenu.bill, onBillPress, billAi, billHint],
  ];
  return (
    <AnimatedSheet
      visible={visible}
      onClose={onClose}
      variant="sheet"
      testID="entry-menu-modal"
      backdropLabel={vi.entryMenu.cancel}
    >
      <View style={styles.sheet} testID="entry-menu">
        <Text style={styles.title}>{vi.entryMenu.title}</Text>
        <PressableScale testID="entry-menu-manual" accessibilityRole="button" onPress={onManual} style={styles.item}>
          <Text style={styles.itemText}>{vi.entryMenu.manual}</Text>
        </PressableScale>
        {aiItems.map(([id, label, onPress, ai, hint]) => {
          const enabled = !!onPress;
          const dim = !onPress || !ai;
          return (
            <PressableScale
              key={id}
              testID={id}
              accessibilityRole="button"
              disabled={!enabled}
              onPress={onPress}
              style={styles.item}
            >
              <Text style={[styles.itemText, dim ? { color: colors.neutral } : null]}>{label}</Text>
              {enabled && hint ? (
                <Text testID={`${id}-hint`} style={styles.hint}>
                  {hint}
                </Text>
              ) : null}
            </PressableScale>
          );
        })}
        <PressableScale testID="entry-menu-cancel" accessibilityRole="button" onPress={onClose} style={styles.item}>
          <Text style={[styles.itemText, { color: colors.textMuted }]}>{vi.entryMenu.cancel}</Text>
        </PressableScale>
      </View>
    </AnimatedSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  title: { fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: colors.text, marginBottom: 8 },
  item: { minHeight: 48, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: colors.divider },
  hint: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
  itemText: { fontFamily: fontFamily.regular, fontSize: fontSize.row, color: colors.text },
});
