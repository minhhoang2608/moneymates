import { StyleSheet, Text, View } from "react-native";

import type { TransactionRow } from "@/db/repositories";
import { signedAmountLabel } from "@/lib/transaction/form";
import { colors, fontFamily, fontSize } from "@/theme";

export function TransactionListItem({ txn, categoryName }: { txn: TransactionRow; categoryName: string }) {
  return (
    <View style={styles.row} testID={`txn-item-${txn.id}`}>
      <View style={styles.main}>
        <Text style={styles.category}>{categoryName}</Text>
        {txn.note ? <Text style={styles.note}>{txn.note}</Text> : null}
      </View>
      <Text style={[styles.amount, { color: txn.type === "expense" ? colors.expense : colors.primary }]}>
        {signedAmountLabel(txn.type, txn.amount)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  main: { flex: 1, paddingRight: 12 },
  category: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.text },
  note: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
  amount: { fontFamily: fontFamily.bold, fontSize: fontSize.row },
});
