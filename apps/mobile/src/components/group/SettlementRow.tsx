import { Pressable, StyleSheet, Text, View } from "react-native";

import { vi } from "@/i18n/vi";
import type { SummaryItemView } from "@/lib/group/summaryView";
import { colors, fontFamily, fontSize, radii } from "@/theme";

const t = vi.groupSummary;

export function SettlementRow({
  item,
  last,
  onQr,
  onMarkPaid,
}: {
  item: SummaryItemView;
  last: boolean;
  onQr: () => void;
  onMarkPaid: () => void;
}) {
  return (
    <View style={[styles.row, !last && styles.border]} testID={`settle-item-${item.memberId}`}>
      <Text style={styles.label}>{item.label}</Text>
      {item.hasQr ? (
        <Pressable testID={`qr-${item.memberId}`} accessibilityRole="button" style={styles.qrBtn} onPress={onQr}>
          <Text style={styles.qrText}>{t.qr}</Text>
        </Pressable>
      ) : null}
      <Pressable
        testID={`mark-paid-${item.memberId}`}
        accessibilityRole="button"
        style={styles.paidBtn}
        onPress={onMarkPaid}
      >
        <Text style={styles.paidText}>{t.markPaid}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: 60, flexDirection: "row", alignItems: "center", gap: 8 },
  border: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  label: { flex: 1, fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.text },
  qrBtn: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    backgroundColor: colors.primarySoft,
    justifyContent: "center",
  },
  qrText: { fontFamily: fontFamily.semibold, fontSize: fontSize.secondary, color: colors.primaryDark },
  paidBtn: {
    height: 36,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  paidText: { fontFamily: fontFamily.semibold, fontSize: fontSize.caption, color: colors.text },
});
