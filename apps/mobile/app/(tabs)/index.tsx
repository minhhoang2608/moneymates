import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { EntryMenu } from "@/components/EntryMenu";
import { TransactionListItem } from "@/components/transaction/TransactionListItem";
import { useRepositories } from "@/db/RepositoriesProvider";
import { vi } from "@/i18n/vi";
import { formatVnd } from "@/lib/money";
import { loadOverview, type OverviewData } from "@/lib/stats/loadOverview";
import { usePendingHandOff } from "@/stores/pendingHandOff";
import { chartColors, colors, fontFamily, fontSize, layout, radii } from "@/theme";

export default function OverviewScreen() {
  const router = useRouter();
  const repos = useRepositories();
  const { profile } = repos;
  const [menuOpen, setMenuOpen] = useState(false);
  const [data, setData] = useState<OverviewData | null>(null);
  const [name, setName] = useState("");

  const deletedVersion = usePendingHandOff((s) => s.deletedVersion);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void deletedVersion; // reload after the return banner deletes a payment
      Promise.all([loadOverview(repos), profile.getProfile()]).then(([d, p]) => {
        if (!alive) return;
        setData(d);
        setName(p.display_name);
      });
      return () => {
        alive = false;
      };
    }, [repos, profile, deletedVersion]),
  );

  const o = data?.overview;
  const topTotal = o ? o.top.reduce((a, c) => a + c.amount, 0) : 0;
  const otherAmount = o ? Math.max(0, o.expenseTotal - o.myShareTotal - topTotal) : 0;
  const bar = o ? [...o.top.map((c) => c.amount), ...(otherAmount > 0 ? [otherAmount] : [])] : [];

  return (
    <View style={styles.root} testID="screen-overview">
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>{vi.overview.greeting(name)}</Text>
            {data ? <Text style={styles.subtitle}>{vi.overview.monthTitle(data.month)}</Text> : null}
          </View>
          <Pressable
            testID="overview-add-button"
            accessibilityRole="button"
            accessibilityLabel={vi.overview.add}
            onPress={() => setMenuOpen(true)}
            style={styles.add}
          >
            <Text style={styles.addText}>+</Text>
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroLabel}>{vi.overview.spentThisMonth}</Text>
          <Text style={styles.heroAmount} testID="overview-expense">
            {formatVnd(o?.expenseTotal ?? 0)}
          </Text>
          {o && o.myShareTotal > 0 ? (
            <Text style={styles.heroNote} testID="overview-group-share">
              {vi.overview.groupShareNote(formatVnd(o.myShareTotal))}
            </Text>
          ) : null}
          <View style={styles.tiles}>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>{vi.overview.income}</Text>
              <Text style={styles.tileAmount} testID="overview-income">
                {formatVnd(o?.incomeTotal ?? 0)}
              </Text>
            </View>
            <View style={styles.tile}>
              <Text style={styles.tileLabel}>{vi.overview.lastMonthSpent}</Text>
              <Text style={styles.tileAmount} testID="overview-last-expense">
                {formatVnd(o?.lastExpenseTotal ?? 0)}
              </Text>
            </View>
          </View>
        </View>

        {o && o.alert !== "none" ? (
          <View style={styles.banner} testID="overview-banner" accessibilityRole="alert">
            <Text style={styles.bannerText}>
              {o.alert === "up" ? vi.overview.bannerUp(o.percent) : vi.overview.bannerDown(o.percent)}
            </Text>
          </View>
        ) : null}

        {o && o.top.length > 0 ? (
          <View style={styles.card} testID="overview-top">
            <Text style={styles.cardTitle}>{vi.overview.topCategories}</Text>
            <View style={styles.stack}>
              {bar.map((amount, i) => (
                <View
                  key={i}
                  style={{ flex: amount, backgroundColor: chartColors[Math.min(i, chartColors.length - 1)] }}
                />
              ))}
            </View>
            {o.top.map((c, i) => (
              <View key={c.category} style={styles.legendRow} testID={`overview-top-${i}`}>
                <View style={[styles.dot, { backgroundColor: chartColors[Math.min(i, chartColors.length - 1)] }]} />
                <Text style={styles.legendName}>{c.category}</Text>
                <Text style={styles.legendAmount}>{formatVnd(c.amount)}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Text style={styles.cardTitle}>{vi.overview.recent}</Text>
            <Pressable testID="overview-see-all" onPress={() => router.push("/history")}>
              <Text style={styles.link}>{vi.overview.seeAll}</Text>
            </Pressable>
          </View>
          <View testID="overview-recent-list">
            {data && !data.hasAny ? <Text style={styles.empty}>{vi.overview.empty}</Text> : null}
            {data?.recent.map((t) => (
              <Pressable
                key={t.id}
                testID={`overview-open-${t.id}`}
                onPress={() => router.push(`/transaction/${t.id}`)}
              >
                <TransactionListItem txn={t} categoryName={data.categoryNames[t.category_id] ?? ""} />
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
      <EntryMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onManual={() => {
          setMenuOpen(false);
          router.push("/transaction/new");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 56, backgroundColor: colors.background },
  scroll: { paddingHorizontal: layout.screenPadding, paddingBottom: 24, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.heading, color: colors.text },
  subtitle: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.textMuted },
  add: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  addText: { fontFamily: fontFamily.bold, fontSize: 24, color: colors.onPrimary },
  hero: { backgroundColor: colors.primary, borderRadius: radii.hero, padding: 20 },
  heroLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.secondary, color: colors.onPrimary },
  heroAmount: { fontFamily: fontFamily.extrabold, fontSize: fontSize.hero, color: colors.onPrimary },
  heroNote: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.onPrimary },
  tiles: { flexDirection: "row", gap: 10, marginTop: 14 },
  tile: { flex: 1, backgroundColor: colors.primaryDark, borderRadius: radii.input, padding: 12 },
  tileLabel: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.onPrimary },
  tileAmount: { fontFamily: fontFamily.bold, fontSize: fontSize.body, color: colors.onPrimary },
  banner: {
    backgroundColor: colors.warningBg,
    borderColor: colors.warningBorder,
    borderWidth: 1,
    borderRadius: radii.input,
    padding: 12,
  },
  bannerText: { fontFamily: fontFamily.medium, fontSize: fontSize.secondary, color: colors.warningText },
  card: { backgroundColor: colors.surface, borderRadius: radii.card, padding: 16 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardTitle: { fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: colors.text },
  link: { fontFamily: fontFamily.semibold, fontSize: fontSize.secondary, color: colors.primary },
  stack: { flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", marginVertical: 12 },
  legendRow: { flexDirection: "row", alignItems: "center", paddingVertical: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  legendName: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.text },
  legendAmount: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.text },
  empty: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textMuted, paddingVertical: 16 },
});
