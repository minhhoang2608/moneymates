import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/PressableScale";

import { useRepositories } from "@/db/RepositoriesProvider";
import type { GroupExpenseListRow, GroupWithMembers } from "@/db/repositories";
import { vi } from "@/i18n/vi";
import { expenseLine } from "@/lib/group/expenseLine";
import { groupByDay } from "@/lib/history";
import { formatVnd } from "@/lib/money";
import { colors, fontFamily, fontSize, layout, radii } from "@/theme";

const t = vi.groupDetail;

type Loaded = {
  group: GroupWithMembers | null;
  total: number;
  expenses: GroupExpenseListRow[];
  categoryNames: Map<string, string>;
};

export default function GroupDetailScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = String(id);
  const { groups, groupExpenses, categories } = useRepositories();
  const [data, setData] = useState<Loaded | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        let group: GroupWithMembers | null = null;
        try {
          group = await groups.getGroup(groupId);
        } catch {
          group = null;
        }
        const [total, expenses, cats] = group
          ? await Promise.all([
              groupExpenses.groupTotal(groupId),
              groupExpenses.listGroupExpenses(groupId),
              categories.listByKind("expense"),
            ])
          : [0, [], []];
        if (!alive) return;
        setData({ group, total, expenses, categoryNames: new Map(cats.map((c) => [c.id, c.name])) });
      })();
      return () => {
        alive = false;
      };
    }, [groups, groupExpenses, categories, groupId]),
  );

  const confirmDelete = () => {
    Alert.alert(t.deleteTitle, t.deleteMessage, [
      { text: t.cancel, style: "cancel" },
      {
        text: t.confirmDelete,
        style: "destructive",
        onPress: async () => {
          await groups.deleteGroup(groupId);
          router.back();
        },
      },
    ]);
  };

  const group = data?.group ?? null;
  const days = groupByDay(data?.expenses ?? []);
  const memberName = (memberId: string | null) => {
    const m = group?.members.find((x) => x.id === memberId);
    return { name: m?.displayName ?? "", isMe: m?.isMe ?? false };
  };

  return (
    <View style={styles.root} testID="screen-group-detail">
      <View testID="screen-header" style={[styles.header, { paddingTop: insets.top, height: 64 + insets.top }]}>
        <PressableScale
          testID="group-back"
          accessibilityRole="button"
          accessibilityLabel={t.back}
          onPress={() => router.back()}
          style={styles.iconBtn}
        >
          <Text style={styles.backText}>‹</Text>
        </PressableScale>
        <Text style={styles.title} numberOfLines={1}>
          {group?.name ?? ""}
        </Text>
        {group ? (
          <PressableScale
            testID="group-edit"
            accessibilityRole="button"
            accessibilityLabel={t.edit}
            onPress={() => router.push({ pathname: "/group/edit", params: { id: groupId } })}
            style={styles.iconBtn}
          >
            <Text style={styles.editText}>{vi.detail.edit}</Text>
          </PressableScale>
        ) : null}
      </View>

      {data && !group ? (
        <Text style={styles.notFound} testID="group-not-found">
          {t.notFound}
        </Text>
      ) : null}

      {group ? (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.hero}>
              <Text style={styles.heroLabel}>{t.total}</Text>
              <Text style={styles.heroTotal} testID="group-total">
                {formatVnd(data?.total ?? 0)}
              </Text>
              <PressableScale
                testID="group-summary"
                accessibilityRole="button"
                style={styles.primaryBtn}
                onPress={() => router.push({ pathname: "/group/summary", params: { id: groupId } })}
              >
                <Text style={styles.primaryText}>{t.summary}</Text>
              </PressableScale>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>{t.expenses}</Text>
              {data && data.expenses.length === 0 ? (
                <Text style={styles.empty} testID="group-expenses-empty">
                  {t.empty}
                </Text>
              ) : null}
              {days.map((day) => (
                <View key={day.dayKey}>
                  <Text style={styles.dayLabel}>{day.label}</Text>
                  {day.rows.map((row) => {
                    const payer = memberName(row.paid_by_member_id);
                    const title = row.note || data?.categoryNames.get(row.category_id) || "";
                    return (
                      <View key={row.id} style={styles.row} testID={`group-expense-${row.id}`}>
                        <View style={styles.rowText}>
                          <Text style={styles.rowTitle}>{title}</Text>
                          <Text style={styles.rowMeta}>
                            {expenseLine({
                              payerName: payer.name,
                              payerIsMe: payer.isMe,
                              splitMode: row.split_mode,
                              shareCount: row.share_count,
                            })}
                          </Text>
                        </View>
                        <Text style={styles.rowAmount}>{formatVnd(row.amount)}</Text>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>

            <PressableScale
              testID="group-delete"
              accessibilityRole="button"
              style={styles.delete}
              onPress={confirmDelete}
            >
              <Text style={styles.deleteText}>{t.delete}</Text>
            </PressableScale>
          </ScrollView>
          <View style={styles.footer}>
            <PressableScale
              testID="group-add-expense"
              accessibilityRole="button"
              style={styles.outlineBtn}
              onPress={() => router.push({ pathname: "/transaction/new", params: { groupId } })}
            >
              <Text style={styles.outlineText}>{t.addExpense}</Text>
            </PressableScale>
          </View>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { height: 64, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: { minWidth: 44, height: 44, alignItems: "center", justifyContent: "center" },
  backText: { fontFamily: fontFamily.semibold, fontSize: 28, color: colors.text },
  editText: { fontFamily: fontFamily.semibold, fontSize: fontSize.row, color: colors.primary },
  title: { flex: 1, fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: colors.text },
  notFound: {
    padding: 24,
    textAlign: "center",
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  content: { paddingHorizontal: layout.screenPadding, paddingBottom: 140, gap: 14 },
  hero: { backgroundColor: colors.surface, borderRadius: radii.profileCard, padding: 16, gap: 8 },
  heroLabel: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
  heroTotal: { fontFamily: fontFamily.bold, fontSize: 22, color: colors.text, marginBottom: 6 },
  primaryBtn: {
    height: 48,
    borderRadius: radii.button,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontFamily: fontFamily.semibold, fontSize: fontSize.row, color: colors.onPrimary },
  card: { backgroundColor: colors.surface, borderRadius: radii.card, paddingHorizontal: 16, paddingVertical: 4 },
  cardTitle: { fontFamily: fontFamily.semibold, fontSize: fontSize.row, color: colors.text, paddingVertical: 12 },
  empty: {
    paddingBottom: 16,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  dayLabel: {
    paddingTop: 8,
    paddingBottom: 4,
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
  row: {
    minHeight: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.text },
  rowMeta: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
  rowAmount: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.text },
  delete: { height: 48, alignItems: "center", justifyContent: "center" },
  deleteText: { fontFamily: fontFamily.semibold, fontSize: fontSize.row, color: colors.expense },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  outlineBtn: {
    height: 52,
    borderRadius: radii.button,
    borderWidth: 1.5,
    borderColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  outlineText: { fontFamily: fontFamily.semibold, fontSize: fontSize.row, color: colors.primary },
});
