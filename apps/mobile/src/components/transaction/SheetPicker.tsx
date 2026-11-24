import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/PressableScale";

import { vi } from "@/i18n/vi";
import { colors, fontFamily, fontSize, radii } from "@/theme";

export type SheetOption = { key: string; label: string; testID: string };

/** Bottom-sheet single-choice list shared by the category and money source pickers. */
export function SheetPicker({
  visible,
  title,
  options,
  selectedKey,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: SheetOption[];
  selectedKey: string | null;
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* bare-pressable-ok: modal backdrop, not a visual button */}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={vi.txn.close} />
      <View style={styles.sheet}>
        <Text style={styles.title}>{title}</Text>
        <ScrollView>
          {options.map((o) => (
            <PressableScale
              key={o.key}
              testID={o.testID}
              accessibilityRole="button"
              onPress={() => onSelect(o.key)}
              style={styles.item}
            >
              <Text style={[styles.itemText, o.key === selectedKey && styles.itemSelected]}>{o.label}</Text>
            </PressableScale>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    maxHeight: "60%",
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
  itemSelected: { fontFamily: fontFamily.semibold, color: colors.primary },
});
