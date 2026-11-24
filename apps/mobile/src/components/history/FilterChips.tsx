import { ScrollView, StyleSheet, Text } from "react-native";
import { PressableScale } from "@/components/PressableScale";

import { vi } from "@/i18n/vi";
import { colors, fontFamily, fontSize, radii } from "@/theme";

export type Chip = { key: string; label: string; active: boolean; onPress: () => void };

export function FilterChips({ chips, showClear, onClear }: { chips: Chip[]; showClear: boolean; onClear: () => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {chips.map((c) => (
        <PressableScale
          key={c.key}
          testID={`history-chip-${c.key}`}
          accessibilityRole="button"
          onPress={c.onPress}
          style={[styles.chip, c.active && styles.chipActive]}
        >
          <Text style={[styles.chipText, c.active && styles.chipTextActive]}>{c.label}</Text>
        </PressableScale>
      ))}
      {showClear ? (
        <PressableScale
          testID="history-clear-filters"
          accessibilityRole="button"
          onPress={onClear}
          style={styles.clear}
        >
          <Text style={styles.clearText}>{vi.history.clearFilters}</Text>
        </PressableScale>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: 8, paddingVertical: 10, alignItems: "center" },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radii.chip,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontFamily: fontFamily.medium, fontSize: fontSize.secondary, color: colors.text },
  chipTextActive: { color: colors.primary },
  clear: { paddingHorizontal: 8, height: 36, justifyContent: "center" },
  clearText: { fontFamily: fontFamily.semibold, fontSize: fontSize.secondary, color: colors.primary },
});
