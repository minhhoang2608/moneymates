import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { useAiAvailable } from "@/api/features";
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
  const voiceAi = useAiAvailable("parse_text").available;
  const billAi = useAiAvailable("parse_bill").available;
  const aiItems: [string, string, (() => void) | undefined, boolean][] = [
    ["entry-menu-voice", vi.entryMenu.voice, onVoice, voiceAi],
    ["entry-menu-bill", vi.entryMenu.bill, onBill, billAi],
  ];
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={vi.entryMenu.cancel} />
      <View style={styles.sheet} testID="entry-menu">
        <Text style={styles.title}>{vi.entryMenu.title}</Text>
        <Pressable testID="entry-menu-manual" accessibilityRole="button" onPress={onManual} style={styles.item}>
          <Text style={styles.itemText}>{vi.entryMenu.manual}</Text>
        </Pressable>
        {aiItems.map(([id, label, onPress, ai]) => {
          const enabled = !!onPress && ai;
          return (
            <Pressable
              key={id}
              testID={id}
              accessibilityRole="button"
              disabled={!enabled}
              onPress={onPress}
              style={styles.item}
            >
              <Text style={[styles.itemText, enabled ? null : { color: colors.neutral }]}>{label}</Text>
            </Pressable>
          );
        })}
        <Pressable testID="entry-menu-cancel" accessibilityRole="button" onPress={onClose} style={styles.item}>
          <Text style={[styles.itemText, { color: colors.textMuted }]}>{vi.entryMenu.cancel}</Text>
        </Pressable>
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
    paddingTop: 16,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  title: { fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: colors.text, marginBottom: 8 },
  item: { minHeight: 48, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: colors.divider },
  itemText: { fontFamily: fontFamily.regular, fontSize: fontSize.row, color: colors.text },
});
