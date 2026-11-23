import { StyleSheet, Text, View } from "react-native";

import type { TransactionRow } from "@/db/repositories";
import { vi } from "@/i18n/vi";
import { timeOf } from "@/lib/history";
import { signedAmountLabel } from "@/lib/transaction/form";
import { colors, fontFamily, fontSize } from "@/theme";

function initials(s: string): string {
  return s.trim().slice(0, 1).toLocaleUpperCase("vi") || "?";
}

export function HistoryRow({ txn, categoryName }: { txn: TransactionRow; categoryName: string }) {
  const title = txn.note || categoryName;
  const source = vi.history.sources[txn.source] ?? txn.money_source;
  return (
    <View style={styles.row} testID={`history-row-${txn.id}`}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{initials(title)}</Text>
      </View>
      <View style={styles.main}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.sub} numberOfLines={1}>
          {`${categoryName} · ${source} · ${timeOf(txn.occurred_at)}`}
        </Text>
      </View>
      <Text style={[styles.amount, { color: txn.type === "expense" ? colors.expense : colors.primary }]}>
        {signedAmountLabel(txn.type, txn.amount)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 4,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.primary },
  main: { flex: 1, paddingHorizontal: 12 },
  title: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.text },
  sub: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
  amount: { fontFamily: fontFamily.bold, fontSize: fontSize.row },
});
