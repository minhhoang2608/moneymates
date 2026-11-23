import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { TargetPickerSheet } from "@/components/target/TargetPickerSheet";
import type { TargetPickerSheetProps } from "@/components/target/TargetPickerSheet";
import { vi } from "@/i18n/vi";
import { targetName } from "@/lib/target";
import type { Target } from "@/lib/target";
import { colors, fontFamily, fontSize } from "@/theme";

export type TargetLineProps = Omit<TargetPickerSheetProps, "visible" | "selected" | "onSelect" | "onClose"> & {
  value: Target;
  onChange: (t: Target) => void;
};

/** "Ghi vào  <tên> ›" form row; tapping opens the target picker sheet. */
export function TargetLine({ value, onChange, ...sheet }: TargetLineProps) {
  const [open, setOpen] = useState(false);
  const label = `${targetName(value)} ›`;
  return (
    <View>
      <Pressable
        testID="target-line"
        accessibilityRole="button"
        accessibilityLabel={`${vi.target.line}: ${label}`}
        onPress={() => setOpen(true)}
        style={styles.row}
      >
        <Text style={styles.label}>{vi.target.line}</Text>
        <Text style={styles.value}>{label}</Text>
      </Pressable>
      <TargetPickerSheet
        {...sheet}
        visible={open}
        selected={value}
        onSelect={(t) => {
          onChange(t);
          setOpen(false);
        }}
        onClose={() => setOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  label: { fontFamily: fontFamily.regular, fontSize: fontSize.row, color: colors.textMuted },
  value: { fontFamily: fontFamily.semibold, fontSize: fontSize.row, color: colors.text },
});
