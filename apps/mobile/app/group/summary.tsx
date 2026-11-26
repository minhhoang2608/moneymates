import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/PressableScale";

import { QrPopup, type QrMode } from "@/components/group/QrPopup";
import { MemberExpensesSheet } from "@/components/group/MemberExpensesSheet";
import { SettlementRow } from "@/components/group/SettlementRow";
import { useRepositories } from "@/db/RepositoriesProvider";
import type { BankAccountRow, GroupWithMembers, MemberExpense } from "@/db/repositories";
import { vi } from "@/i18n/vi";
import { buildPaybackQr } from "@/lib/group/paybackQr";
import { toSummaryView, type SummaryView } from "@/lib/group/summaryView";
import { formatVnd } from "@/lib/money";
import { colors, fontFamily, fontSize, layout, radii } from "@/theme";

const t = vi.groupSummary;

type Loaded = {
  group: GroupWithMembers | null;
  total: number;
  view: SummaryView;
  account: BankAccountRow | null;
  accountLabel: string | null;
  categoryNames: Map<string, string>;
};

const EMPTY_VIEW: SummaryView = { rows: [], items: [], toCollect: 0 };

export default function GroupSummaryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const groupId = String(id);
  const { groups, groupExpenses, settlements, bankAccounts, categories } = useRepositories();
  const [data, setData] = useState<Loaded | null>(null);
  const [sheet, setSheet] = useState<{ memberId: string; name: string; expenses: MemberExpense[] } | null>(null);

  const load = useCallback(async () => {
    let group: GroupWithMembers | null = null;
    try {
      group = await groups.getGroup(groupId);
    } catch {
      group = null;
    }
    if (!group)
      return { group: null, total: 0, view: EMPTY_VIEW, account: null, accountLabel: null, categoryNames: new Map() };
    const [total, summary, accounts, cats] = await Promise.all([
      groupExpenses.groupTotal(groupId),
      settlements.getGroupSummary(groupId),
      bankAccounts.listAccounts(),
      categories.listByKind("expense"),
    ]);
    const account = accounts.find((a) => a.id === group.receiving_account_id);
    return {
      group,
      total,
      view: toSummaryView(group.members, summary, vi.groups.me),
      account: account ?? null,
      accountLabel: account ? `${account.bank_name} •••• ${account.account_no.slice(-4)}` : null,
      categoryNames: new Map(cats.map((c) => [c.id, c.name])),
    } satisfies Loaded;
  }, [groups, groupExpenses, settlements, bankAccounts, categories, groupId]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      load().then((d) => {
        if (alive) setData(d);
      });
      return () => {
        alive = false;
      };
    }, [load]),
  );

  const markPaid = async (memberId: string, amount: number) => {
    try {
      await settlements.markPaid(groupId, memberId, amount);
    } catch {
      Alert.alert(t.errorTitle, t.markPaidError);
    }
    setData(await load());
  };

  const openMember = async (memberId: string, name: string) => {
    try {
      const expenses = await settlements.listMemberExpenses(groupId, memberId);
      setSheet({ memberId, name, expenses });
    } catch {
      Alert.alert(t.errorTitle, t.loadError);
    }
  };

  const [qr, setQr] = useState<{ memberId: string | null; mode: QrMode } | null>(null);
  const qrItem = qr?.memberId ? data?.view.items.find((i) => i.memberId === qr.memberId) : undefined;
  const qrMember = qr?.memberId ? data?.group?.members.find((m) => m.id === qr.memberId) : undefined;
  const qrGroupName = data?.group?.name ?? "";
  const noQr = { kind: "no_account" } as const;

  const group = data?.group ?? null;
  const view = data?.view ?? EMPTY_VIEW;

  return (
    <View style={styles.root} testID="screen-group-summary">
      <View style={[styles.header, { paddingTop: insets.top, height: 64 + insets.top }]}>
        <PressableScale
          testID="summary-back"
          accessibilityRole="button"
          accessibilityLabel={t.back}
          onPress={() => router.back()}
          style={styles.iconBtn}
        >
          <Text style={styles.backText}>‹</Text>
        </PressableScale>
        <View style={styles.headerText}>
          <Text style={styles.title}>{t.title}</Text>
          {group ? (
            <Text style={styles.subtitle} testID="summary-subtitle">
              {`${group.name} · ${formatVnd(data?.total ?? 0)}`}
            </Text>
          ) : null}
        </View>
      </View>

      {data && !group ? (
        <Text style={styles.notFound} testID="group-not-found">
          {vi.groupDetail.notFound}
        </Text>
      ) : null}

      {group ? (
        <>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.card}>
              <View style={[styles.grid, styles.gridHead]}>
                <Text style={[styles.cell1, styles.headText]}>{t.person}</Text>
                <Text style={[styles.cell, styles.headText]}>{t.paid}</Text>
                <Text style={[styles.cell, styles.headText]}>{t.owed}</Text>
                <Text style={[styles.cell2, styles.headText]}>{t.balance}</Text>
              </View>
              {view.rows.map((r, i) => (
                <PressableScale
                  key={r.memberId}
                  testID={`summary-row-${r.memberId}`}
                  accessibilityRole="button"
                  onPress={() => openMember(r.memberId, r.name)}
                  style={[styles.grid, i < view.rows.length - 1 && styles.gridBorder]}
                >
                  <Text style={[styles.cell1, styles.name]} numberOfLines={1}>
                    {r.name}
                  </Text>
                  <Text style={[styles.cell, styles.num]}>{r.paid}</Text>
                  <Text style={[styles.cell, styles.num]}>{r.owed}</Text>
                  <Text
                    style={[
                      styles.cell2,
                      styles.balance,
                      r.tone === "positive" && styles.positive,
                      r.tone === "negative" && styles.negative,
                      r.tone === "zero" && styles.zero,
                    ]}
                  >
                    {r.balance}
                  </Text>
                </PressableScale>
              ))}
              <Text style={styles.hint}>{t.hint}</Text>
            </View>

            <View style={styles.sectionHead}>
              <Text style={styles.sectionTitle}>{t.collectTo}</Text>
              {data?.accountLabel ? (
                <Text style={styles.account} testID="summary-account">
                  {data.accountLabel}
                </Text>
              ) : null}
            </View>
            <View style={styles.card}>
              {view.items.length === 0 ? (
                <Text style={styles.empty} testID="settle-empty">
                  {t.noSettlements}
                </Text>
              ) : null}
              {view.items.map((it, i) => (
                <SettlementRow
                  key={it.memberId}
                  item={it}
                  last={i === view.items.length - 1}
                  onQr={() => setQr({ memberId: it.memberId, mode: "member" })}
                  onMarkPaid={() => markPaid(it.memberId, it.amount)}
                />
              ))}
            </View>

            <View style={styles.remaining}>
              <Text style={styles.remainingLabel}>{t.remaining}</Text>
              <Text style={styles.remainingValue} testID="summary-remaining">
                {formatVnd(view.toCollect)}
              </Text>
            </View>
          </ScrollView>
          <View style={styles.footer}>
            <PressableScale
              testID="qr-group"
              accessibilityRole="button"
              style={styles.outlineBtn}
              onPress={() => setQr({ memberId: null, mode: "group" })}
            >
              <Text style={styles.outlineText}>{t.qrGroup}</Text>
            </PressableScale>
            <Text style={styles.footerHint}>{t.qrGroupHint}</Text>
          </View>
        </>
      ) : null}

      <QrPopup
        visible={qr !== null && group !== null}
        memberName={qrMember && qrItem ? qrMember.displayName : null}
        memberQr={
          qrMember && qrItem
            ? buildPaybackQr({
                groupName: qrGroupName,
                account: data?.account,
                memberName: qrMember.displayName,
                amount: qrItem.amount,
              })
            : noQr
        }
        groupQr={buildPaybackQr({ groupName: qrGroupName, account: data?.account })}
        initialMode={qr?.mode ?? "group"}
        onClose={() => setQr(null)}
        onAddAccount={() => {
          setQr(null);
          router.push("/bank-accounts");
        }}
      />
      <MemberExpensesSheet
        visible={sheet !== null}
        name={sheet?.name ?? ""}
        expenses={sheet?.expenses ?? []}
        categoryNames={data?.categoryNames ?? new Map()}
        onClose={() => setSheet(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 40, backgroundColor: colors.background },
  header: { height: 64, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: { minWidth: 44, height: 44, alignItems: "center", justifyContent: "center" },
  backText: { fontFamily: fontFamily.semibold, fontSize: 28, color: colors.text },
  headerText: { flex: 1 },
  title: { fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: colors.text },
  subtitle: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
  notFound: {
    padding: 24,
    textAlign: "center",
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.textMuted,
  },
  content: { paddingHorizontal: layout.screenPadding, paddingBottom: 140, gap: 14 },
  card: { backgroundColor: colors.surface, borderRadius: radii.card, paddingHorizontal: 16, paddingVertical: 6 },
  grid: { flexDirection: "row", gap: 6, paddingVertical: 10 },
  gridHead: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.divider },
  gridBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  cell1: { flex: 1.1 },
  cell: { flex: 1, textAlign: "right" },
  cell2: { flex: 1.1, textAlign: "right" },
  headText: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
  name: { fontFamily: fontFamily.semibold, fontSize: fontSize.secondary, color: colors.text },
  num: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.text },
  balance: { fontFamily: fontFamily.bold, fontSize: fontSize.secondary },
  positive: { color: colors.primary },
  negative: { color: colors.expense },
  zero: { color: colors.textMuted },
  hint: { paddingTop: 8, fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  sectionTitle: { fontFamily: fontFamily.semibold, fontSize: fontSize.row, color: colors.text },
  account: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
  empty: { paddingVertical: 16, fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textMuted },
  remaining: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radii.card,
    padding: 16,
  },
  remainingLabel: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.primaryDark },
  remainingValue: { fontFamily: fontFamily.bold, fontSize: fontSize.title, color: colors.primaryDark },
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
    gap: 6,
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
  footerHint: {
    textAlign: "center",
    fontFamily: fontFamily.regular,
    fontSize: fontSize.caption,
    color: colors.textMuted,
  },
});
