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
  useEffect(() => {
    if (visible) refreshFeatures();
  }, [visible, refreshFeatures]);
  const voiceAi = useAiAvailable("parse_text").available;
  const billAi = useAiAvailable("parse_bill").available;
  // Voice also works offline (rules only), so it is never gated on AI; bill capture needs the AI.
  const aiItems: [string, string, (() => void) | undefined, boolean, string | null][] = [
    ["entry-menu-voice", vi.entryMenu.voice, onVoice, true, voiceAi ? null : vi.voice.offlineHint],
    ["entry-menu-bill", vi.entryMenu.bill, onBill, billAi, null],
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
          const enabled = !!onPress && ai;
          return (
            <PressableScale
              key={id}
              testID={id}
              accessibilityRole="button"
              disabled={!enabled}
              onPress={onPress}
              style={styles.item}
            >
              <Text style={[styles.itemText, enabled ? null : { color: colors.neutral }]}>{label}</Text>
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
