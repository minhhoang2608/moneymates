import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";
import { PressableScale } from "@/components/PressableScale";

import type { MoneySourceRow } from "@/db/repositories/moneySourceRepository";
import { vi } from "@/i18n/vi";
import { MONEY_SOURCE_KINDS, type MoneySourceKind } from "@/lib/preferences/defaults";
import { colors, fontFamily, fontSize, radii } from "@/theme";

type Props = {
  sources: MoneySourceRow[];
  onAdd: (name: string, kind: MoneySourceKind) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function MoneySourceSection({ sources, onAdd, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<MoneySourceKind>("bank");
  const [error, setError] = useState<string | null>(null);

  async function add() {
    if (!name.trim()) {
      setError(vi.settings.sourceNameRequired);
      return;
    }
    await onAdd(name, kind);
    setName("");
    setError(null);
  }

  function confirmDelete(item: MoneySourceRow) {
    Alert.alert(vi.settings.deleteTitle, vi.settings.deleteMessage, [
      { text: vi.settings.cancel, style: "cancel" },
      { text: vi.settings.delete, style: "destructive", onPress: () => void onDelete(item.id) },
    ]);
  }

  return (
    <View>
      <PressableScale
        testID="settings-sources-row"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
        style={styles.row}
      >
        <Text style={styles.label}>{vi.settings.sources}</Text>
        <Text style={styles.value} numberOfLines={1}>
          {sources.map((s) => s.name).join(", ")} {open ? "⌄" : "›"}
        </Text>
      </PressableScale>
      {open ? (
        <View style={styles.panel} testID="settings-sources-panel">
          {sources.map((s) => (
            <View key={s.id} style={styles.item} testID={`settings-source-${s.id}`}>
              <Text style={styles.itemName}>{s.name}</Text>
              <Text style={styles.itemKind}>{vi.settings.kinds[s.kind as MoneySourceKind]}</Text>
              <PressableScale
                testID={`settings-source-delete-${s.id}`}
                accessibilityRole="button"
                accessibilityLabel={`${vi.settings.sourceDelete} ${s.name}`}
                onPress={() => confirmDelete(s)}
                style={styles.del}
              >
                <Text style={styles.delText}>✕</Text>
              </PressableScale>
            </View>
          ))}
          <TextInput
            testID="settings-source-name"
            value={name}
            onChangeText={(t) => {
              setName(t);
              setError(null);
            }}
            placeholder={vi.settings.sourceNamePlaceholder}
            placeholderTextColor={colors.neutral}
            style={styles.input}
          />
          <View style={styles.kinds}>
            {MONEY_SOURCE_KINDS.map((k) => (
              <PressableScale
                key={k}
                testID={`settings-source-kind-${k}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: kind === k }}
                onPress={() => setKind(k)}
                style={[styles.chip, kind === k && styles.chipOn]}
              >
                <Text style={[styles.chipText, kind === k && styles.chipTextOn]}>{vi.settings.kinds[k]}</Text>
              </PressableScale>
            ))}
          </View>
          {error ? (
            <Text testID="settings-source-error" style={styles.error}>
              {error}
            </Text>
          ) : null}
          <PressableScale testID="settings-source-add" accessibilityRole="button" onPress={add} style={styles.add}>
            <Text style={styles.addText}>{vi.settings.sourceAdd}</Text>
          </PressableScale>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  label: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.text },
  value: {
    flex: 1,
    textAlign: "right",
    fontFamily: fontFamily.regular,
    fontSize: fontSize.secondary,
    color: colors.textMuted,
  },
  panel: { paddingBottom: 12, gap: 10 },
  item: { minHeight: 40, flexDirection: "row", alignItems: "center", gap: 8 },
  itemName: { flex: 1, fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.text },
  itemKind: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
  del: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  delText: { color: colors.expense, fontSize: 14 },
  input: {
    height: 44,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.text,
  },
  kinds: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    height: 36,
    paddingHorizontal: 14,
    borderRadius: radii.chip,
    backgroundColor: colors.segmentBg,
    justifyContent: "center",
  },
  chipOn: { backgroundColor: colors.primary },
  chipText: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.text },
  chipTextOn: { color: colors.onPrimary },
  error: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.expense },
  add: {
    height: 44,
    borderRadius: radii.button,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  addText: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.onPrimary },
});
