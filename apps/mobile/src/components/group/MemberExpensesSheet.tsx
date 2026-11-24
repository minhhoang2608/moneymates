import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/PressableScale";

import type { MemberExpense } from "@/db/repositories";
import { vi } from "@/i18n/vi";
import { formatVnd } from "@/lib/money";
import { colors, fontFamily, fontSize, radii } from "@/theme";

const t = vi.groupSummary;

export function MemberExpensesSheet({
  visible,
  name,
  expenses,
  categoryNames,
  onClose,
}: {
  visible: boolean;
  name: string;
  expenses: MemberExpense[];
  categoryNames: Map<string, string>;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      {/* bare-pressable-ok: modal backdrop, not a visual button */}
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t.close} />
      <View style={styles.sheet} testID="member-expenses-sheet">
        <Text style={styles.title}>{t.memberExpenses(name)}</Text>
        <ScrollView>
          {expenses.length === 0 ? <Text style={styles.empty}>{t.empty}</Text> : null}
          {expenses.map((e) => {
            const x = e.transaction;
            const title = x.note || categoryNames.get(x.category_id) || "";
            return (
              <View key={x.id} style={styles.item} testID={`member-expense-${x.id}`}>
                <View style={styles.text}>
                  <Text style={styles.itemTitle}>{title}</Text>
                  <Text style={styles.meta}>
                    {x.occurred_at.slice(0, 10).split("-").reverse().join("/")}
                    {e.paidByMe ? ` · ${t.paidBy}` : ""}
                    {e.myShare > 0 ? ` · ${t.owedShare(formatVnd(e.myShare))}` : ""}
                  </Text>
                </View>
                <Text style={styles.amount}>{formatVnd(Number(x.amount))}</Text>
              </View>
            );
          })}
        </ScrollView>
        <PressableScale
          testID="member-expenses-close"
          accessibilityRole="button"
          style={styles.close}
          onPress={onClose}
        >
          <Text style={styles.closeText}>{t.close}</Text>
        </PressableScale>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: {
    maxHeight: "70%",
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
  empty: { paddingVertical: 12, fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textMuted },
  item: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  text: { flex: 1, gap: 2 },
  itemTitle: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.text },
  meta: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
  amount: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.text },
  close: { height: 48, alignItems: "center", justifyContent: "center", marginTop: 8 },
  closeText: { fontFamily: fontFamily.semibold, fontSize: fontSize.row, color: colors.primary },
});
