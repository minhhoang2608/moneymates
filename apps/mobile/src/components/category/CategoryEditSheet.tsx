import { useState } from "react";
import { Keyboard, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { PressableScale } from "@/components/PressableScale";

import type { CategoryRow } from "@/db/repositories";
import { vi } from "@/i18n/vi";
import { CATEGORY_COLORS } from "@/lib/category/palette";
import { colors, fontFamily, fontSize, radii } from "@/theme";

export type CategoryDraft = { name: string; icon: string; color: string };

/** Mount it only while open (state starts from `item`). Add (item = null) or edit sheet. Default categories keep their name read-only. */
export function CategoryEditSheet({
  item,
  onSave,
  onDelete,
  onClose,
}: {
  item: CategoryRow | null;
  onSave: (draft: CategoryDraft) => Promise<void>;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [icon, setIcon] = useState(item?.icon ?? "");
  const [color, setColor] = useState<string>(item?.color ?? CATEGORY_COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  const isDefault = item?.is_default ?? false;

  async function save() {
    if (!name.trim()) {
      setError(vi.categories.nameRequired);
      return;
    }
    const fallback = name.trim().slice(0, 2).toUpperCase();
    await onSave({ name, icon: icon.trim() || fallback, color });
  }

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      {/* bare-pressable-ok: modal backdrop, not a visual button */}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={vi.txn.close} />
      <View style={styles.sheet} testID="category-sheet">
        {/* bare-pressable-ok: only dismisses the keyboard, no visual button */}
        <Pressable testID="category-sheet-title" accessible accessibilityRole="header" onPress={Keyboard.dismiss}>
          <Text style={styles.title}>{item ? vi.categories.editTitle : vi.categories.addTitle}</Text>
        </Pressable>
        <Text style={styles.label}>{vi.categories.name}</Text>
        <TextInput
          testID="category-name-input"
          style={[styles.input, isDefault && styles.readonly]}
          value={name}
          editable={!isDefault}
          onChangeText={(v) => {
            setName(v);
            setError(null);
          }}
        />
        {error ? (
          <Text style={styles.error} testID="category-name-error">
            {error}
          </Text>
        ) : null}
        <Text style={styles.label}>{vi.categories.icon}</Text>
        <TextInput
          testID="category-icon-input"
          style={styles.input}
          value={icon}
          maxLength={2}
          autoCapitalize="characters"
          onChangeText={setIcon}
        />
        <Text style={styles.label}>{vi.categories.color}</Text>
        <View style={styles.swatches}>
          {CATEGORY_COLORS.map((c, i) => (
            <PressableScale
              key={c}
              testID={`category-color-${i}`}
              accessibilityRole="button"
              onPress={() => setColor(c)}
              style={[styles.swatch, { backgroundColor: c }, c === color && styles.swatchOn]}
            />
          ))}
        </View>
        <PressableScale testID="category-save" accessibilityRole="button" onPress={save} style={styles.save}>
          <Text style={styles.saveText}>{vi.categories.save}</Text>
        </PressableScale>
        {item && !isDefault ? (
          <PressableScale testID="category-delete" accessibilityRole="button" onPress={onDelete} style={styles.delete}>
            <Text style={styles.deleteText}>{vi.categories.delete}</Text>
          </PressableScale>
        ) : null}
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
  label: { fontFamily: fontFamily.semibold, fontSize: fontSize.secondary, color: colors.textMuted, marginTop: 10 },
  input: {
    height: 44,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    marginTop: 6,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.row,
    color: colors.text,
  },
  readonly: { backgroundColor: colors.background, color: colors.textMuted },
  error: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.expense, marginTop: 4 },
  swatches: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8 },
  swatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: colors.surface },
  swatchOn: { borderColor: colors.text },
  save: {
    height: 48,
    borderRadius: radii.button,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  saveText: { fontFamily: fontFamily.semibold, fontSize: fontSize.row, color: colors.onPrimary },
  delete: { height: 44, alignItems: "center", justifyContent: "center", marginTop: 8 },
  deleteText: { fontFamily: fontFamily.semibold, fontSize: fontSize.row, color: colors.expense },
});
