import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { vi } from "@/i18n/vi";
import { colors, fontFamily, fontSize, radii } from "@/theme";

/** Action sheet for adding a transaction. Voice and bill capture arrive in later tickets. */
export function EntryMenu({
  visible,
  onManual,
  onClose,
}: {
  visible: boolean;
  onManual: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={vi.entryMenu.cancel} />
      <View style={styles.sheet} testID="entry-menu">
        <Text style={styles.title}>{vi.entryMenu.title}</Text>
        <Pressable testID="entry-menu-manual" accessibilityRole="button" onPress={onManual} style={styles.item}>
          <Text style={styles.itemText}>{vi.entryMenu.manual}</Text>
        </Pressable>
        {[
          ["entry-menu-voice", vi.entryMenu.voice],
          ["entry-menu-bill", vi.entryMenu.bill],
        ].map(([id, label]) => (
          <Pressable key={id} testID={id} accessibilityRole="button" disabled style={styles.item}>
            <Text style={[styles.itemText, { color: colors.neutral }]}>{label}</Text>
          </Pressable>
        ))}
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
