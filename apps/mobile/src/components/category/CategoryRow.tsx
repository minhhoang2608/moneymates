import { Pressable, StyleSheet, Text, View } from "react-native";

import type { CategoryRow as Row } from "@/db/repositories";
import { vi } from "@/i18n/vi";
import { colors, fontFamily, fontSize } from "@/theme";

import { CategoryBadge } from "./CategoryTile";

/** Custom category list row with "Sửa" and "Xóa". */
export function CategoryRow({
  item,
  last,
  onEdit,
  onDelete,
}: {
  item: Row;
  last: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <View style={[styles.row, !last && styles.border]} testID={`category-row-${item.id}`}>
      <CategoryBadge icon={item.icon} color={item.color} />
      <Text style={styles.name}>{item.name}</Text>
      <Pressable testID={`category-edit-${item.id}`} accessibilityRole="button" onPress={onEdit} style={styles.btn}>
        <Text style={styles.btnText}>{vi.categories.edit}</Text>
      </Pressable>
      <Pressable
        testID={`category-delete-${item.id}`}
        accessibilityRole="button"
        onPress={onDelete}
        style={[styles.btn, styles.danger]}
      >
        <Text style={[styles.btnText, { color: colors.expense }]}>{vi.categories.delete}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 12 },
  border: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  name: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.text },
  btn: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  danger: { borderColor: colors.expenseBorder },
  btnText: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.text },
});
