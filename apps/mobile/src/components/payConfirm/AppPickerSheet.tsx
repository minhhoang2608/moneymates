import { useMemo, useState } from "react";
import { KeyboardAvoidingView, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";

import { AnimatedSheet } from "@/components/AnimatedSheet";
import { PressableScale } from "@/components/PressableScale";
import { vi } from "@/i18n/vi";
import { PAY_APPS, type PayApp } from "@/lib/payConfirm/apps";
import { pickerApps } from "@/lib/payConfirm/preselect";
import { colors, fontFamily, fontSize, radii } from "@/theme";

/** Pixel cap: a percentage maxHeight resolves against an auto-height wrapper and clips the sheet. */
export function appSheetMaxHeight(windowHeight: number): number {
  return Math.round(windowHeight * 0.85);
}

/** Mount it only while open. Search covers the whole catalogue, so hidden apps can still be picked. */
export function AppPickerSheet({
  enabled,
  qrBin,
  recentIds,
  lastUsedId,
  selectedId,
  catalogue = PAY_APPS,
  onSelect,
  onManage,
  onClose,
}: {
  enabled: string[];
  qrBin: string | undefined;
  recentIds: string[];
  /** App last used for this QR's bank, when known. */
  lastUsedId?: string;
  selectedId: string;
  catalogue?: PayApp[];
  onSelect: (id: string) => void;
  onManage: () => void;
  onClose: () => void;
}) {
  const { height } = useWindowDimensions();
  const [query, setQuery] = useState("");
  const rows = useMemo(
    () => pickerApps(enabled, qrBin, recentIds, query, catalogue),
    [enabled, qrBin, recentIds, query, catalogue],
  );
  return (
    <AnimatedSheet
      visible
      onClose={onClose}
      variant="sheet"
      testID="pay-app-sheet"
      backdropTestID="pay-app-sheet-close"
      backdropLabel={vi.txn.close}
    >
      <KeyboardAvoidingView behavior="padding">
        <View style={[styles.sheet, { maxHeight: appSheetMaxHeight(height) }]} accessibilityLabel={vi.appSheet.title}>
          <View style={styles.handle} />
          <Text style={styles.heading}>{vi.appSheet.heading}</Text>
          <TextInput
            testID="pay-app-search"
            value={query}
            onChangeText={setQuery}
            placeholder={vi.appSheet.search}
            placeholderTextColor={colors.neutral}
            autoCorrect={false}
            style={styles.search}
          />
          {rows.length === 0 ? (
            <Text testID="pay-app-empty" style={styles.muted}>
              {vi.payConfirm.noBankMatch}
            </Text>
          ) : (
            <ScrollView testID="pay-app-list" style={styles.list} keyboardShouldPersistTaps="handled">
              {rows.map(({ app, isQrBank, isRecent }, i) => {
                const on = app.id === selectedId;
                const sub = isQrBank
                  ? app.id === lastUsedId
                    ? `${vi.appSheet.qrBank} · ${vi.appSheet.lastUsed}`
                    : vi.appSheet.qrBank
                  : isRecent
                    ? vi.appSheet.recent
                    : null;
                return (
                  <PressableScale
                    key={app.id}
                    testID={`app-${app.id}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected: on }}
                    onPress={() => onSelect(app.id)}
                    style={[styles.row, on && styles.rowOn, i > 0 && styles.rowBorder]}
                  >
                    <View style={styles.appBadge}>
                      <Text style={styles.appBadgeText}>{app.short}</Text>
                    </View>
                    <View style={styles.names}>
                      <Text style={[styles.name, on && styles.nameOn]}>{app.name}</Text>
                      {sub ? (
                        <Text testID={`app-sub-${app.id}`} style={styles.sub}>
                          {sub}
                        </Text>
                      ) : null}
                    </View>
                    <Text testID={`app-badge-${app.id}`} style={styles.mode}>
                      {app.supportsAutofill ? vi.payConfirm.autofill : vi.payConfirm.scanQr}
                    </Text>
                    {on ? <Text style={styles.check}>✓</Text> : null}
                  </PressableScale>
                );
              })}
            </ScrollView>
          )}
          <PressableScale testID="pay-app-manage" accessibilityRole="button" onPress={onManage} style={styles.manage}>
            <Text style={styles.manageText}>{vi.appSheet.manage}</Text>
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
    </AnimatedSheet>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 12,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
  heading: { fontFamily: fontFamily.semibold, fontSize: fontSize.row, color: colors.text },
  search: {
    height: 44,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.text,
  },
  muted: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.textMuted },
  list: { borderWidth: 1, borderColor: colors.divider, borderRadius: radii.card, flexGrow: 0, flexShrink: 1 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  rowOn: { backgroundColor: colors.primarySoft },
  rowBorder: { borderTopWidth: 1, borderTopColor: colors.divider },
  appBadge: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.divider,
    alignItems: "center",
    justifyContent: "center",
  },
  appBadgeText: { fontFamily: fontFamily.bold, fontSize: fontSize.tab, color: colors.textMuted },
  names: { flex: 1, gap: 2 },
  name: { fontFamily: fontFamily.medium, fontSize: fontSize.body, color: colors.text },
  nameOn: { fontFamily: fontFamily.semibold },
  sub: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
  mode: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
  check: { fontSize: 18, color: colors.primary },
  manage: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  manageText: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.primary },
});
