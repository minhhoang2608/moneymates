import { StyleSheet, Text, View } from "react-native";

import { PressableScale } from "@/components/PressableScale";
import { vi } from "@/i18n/vi";
import type { PayApp } from "@/lib/payConfirm/apps";
import { colors, fontFamily, fontSize, radii } from "@/theme";

/** The selected payment app on Xác nhận thanh toán. Pressing it opens the app picker sheet. */
export function PayAppRow({ app, onChange }: { app: PayApp; onChange: () => void }) {
  return (
    <PressableScale
      testID="pay-app-row"
      accessibilityRole="button"
      accessibilityLabel={`${app.name}, ${vi.payConfirm.change}`}
      onPress={onChange}
      style={styles.row}
    >
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{app.short}</Text>
      </View>
      <Text testID="pay-app-row-name" style={styles.name}>
        {app.name}
      </Text>
      <Text testID="pay-app-row-badge" style={styles.mode}>
        {app.supportsAutofill ? vi.payConfirm.autofill : vi.payConfirm.scanQr}
      </Text>
      <Text testID="pay-app-change" style={styles.change}>
        {vi.payConfirm.change}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: colors.surface,
    borderRadius: radii.card,
  },
  badge: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.divider,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: fontFamily.bold, fontSize: fontSize.tab, color: colors.textMuted },
  name: { flex: 1, fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.text },
  mode: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
  change: { fontFamily: fontFamily.semibold, fontSize: fontSize.secondary, color: colors.primary },
});
