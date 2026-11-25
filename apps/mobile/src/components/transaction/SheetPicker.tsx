import { haptics } from "@/lib/haptics";
import { AnimatedSheet } from "@/components/AnimatedSheet";
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { PressableScale } from "@/components/PressableScale";

import { vi } from "@/i18n/vi";
import { colors, fontFamily, fontSize, radii } from "@/theme";

export type SheetOption = { key: string; label: string; testID: string };

/** Pixel cap for the panel: a `%` maxHeight resolves against the auto-height wrapper and leaves a gap. */
export function sheetMaxHeight(windowHeight: number): number {
  return Math.round(windowHeight * 0.6);
}

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
  const { height } = useWindowDimensions();
  return (
    <AnimatedSheet
      visible={visible}
      onClose={onClose}
      variant="sheet"
      testID="sheet-picker"
      backdropLabel={vi.txn.close}
    >
      <View testID="sheet-picker-panel" style={[styles.sheet, { maxHeight: sheetMaxHeight(height) }]}>
        <Text style={styles.title}>{title}</Text>
        <ScrollView testID="sheet-picker-list" style={styles.list}>
          {options.map((o) => (
            <PressableScale
              key={o.key}
              testID={o.testID}
              accessibilityRole="button"
              onPress={() => {
                haptics.selection();
                onSelect(o.key);
              }}
              style={styles.item}
            >
              <Text style={[styles.itemText, o.key === selectedKey && styles.itemSelected]}>{o.label}</Text>
            </PressableScale>
          ))}
        </ScrollView>
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
  list: { flexGrow: 0 },
  title: { fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: colors.text, marginBottom: 8 },
  item: { minHeight: 48, justifyContent: "center", borderBottomWidth: 1, borderBottomColor: colors.divider },
  itemText: { fontFamily: fontFamily.regular, fontSize: fontSize.row, color: colors.text },
  itemSelected: { fontFamily: fontFamily.semibold, color: colors.primary },
});
