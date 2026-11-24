import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { PressableScale } from "@/components/PressableScale";
import { SkeletonCard } from "@/components/Skeleton";
import { EntryMenu } from "@/components/EntryMenu";
import { CalendarIcon, PlusIcon } from "@/components/icons";
import { SheetPicker } from "@/components/transaction/SheetPicker";
import { TransactionListItem } from "@/components/transaction/TransactionListItem";
import { useRepositories } from "@/db/RepositoriesProvider";
import { vi } from "@/i18n/vi";
import { monthNumber, recentMonths } from "@/lib/history/filter";
import { formatVnd } from "@/lib/money";
import { fadeInProps, useReduceMotion } from "@/lib/motion";
import { loadOverview, type OverviewData } from "@/lib/stats/loadOverview";
import { usePendingHandOff } from "@/stores/pendingHandOff";
import { chartColors, colors, fontFamily, fontSize, layout, radii } from "@/theme";

export default function OverviewScreen() {
  const router = useRouter();
  const reduceMotion = useReduceMotion();
  const fade = fadeInProps(reduceMotion);
  const repos = useRepositories();
  const { profile } = repos;
  const [menuOpen, setMenuOpen] = useState(false);
  const [data, setData] = useState<OverviewData | null>(null);
  const [name, setName] = useState("");
  const [alertOn, setAlertOn] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickedMonth, setPickedMonth] = useState<string | null>(null);
  const months = useMemo(() => recentMonths(new Date()), []);

  const deletedVersion = usePendingHandOff((s) => s.deletedVersion);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void deletedVersion; // reload after the return banner deletes a payment
      Promise.all([
        loadOverview(repos, {
          myShares: repos.groupExpenses.mySharesInMonth,
          ...(pickedMonth ? { now: new Date(`${pickedMonth}-15T00:00:00Z`) } : {}),
        }),
        profile.getProfile(),
        repos.preferences.getAlertOverLastMonth(),
      ]).then(([d, p, a]) => {
        if (!alive) return;
        setData(d);
        setName(p.display_name);
        setAlertOn(a);
      });
      return () => {
        alive = false;
      };
    }, [repos, profile, deletedVersion, pickedMonth]),
  );

  const o = data?.overview;
  const topTotal = o ? o.top.reduce((a, c) => a + c.amount, 0) : 0;
  const otherAmount = o ? Math.max(0, o.expenseTotal - o.myShareTotal - topTotal) : 0;
  const bar = o ? [...o.top.map((c) => c.amount), ...(otherAmount > 0 ? [otherAmount] : [])] : [];

  return (
    <View style={styles.root} testID="screen-overview">
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.headerText}>
            <Text style={styles.greeting}>{vi.overview.greeting(name)}</Text>
            {data ? <Text style={styles.title}>{vi.overview.monthTitle(data.month)}</Text> : null}
          </View>
          <PressableScale
            testID="overview-month-button"
            accessibilityRole="button"
            accessibilityLabel={vi.overview.changeMonth}
            onPress={() => setPickerOpen(true)}
            style={styles.monthButton}
          >
            <CalendarIcon color={colors.text} size={20} />
          </PressableScale>
        </View>

        {data === null ? (
          <SkeletonCard testID="overview-skeleton" />
        ) : (
          <>
            <Animated.View style={styles.hero} testID="overview-hero" {...fade}>
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
            </Animated.View>

            {o && o.alert !== "none" && alertOn ? (
              <Animated.View style={styles.banner} testID="overview-banner" accessibilityRole="alert" {...fade}>
                <Text style={styles.bannerText}>
                  {o.alert === "up" ? vi.overview.bannerUp(o.percent) : vi.overview.bannerDown(o.percent)}
                </Text>
              </Animated.View>
            ) : null}

            {o && o.top.length > 0 ? (
              <Animated.View style={styles.card} testID="overview-top" {...fade}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle}>{vi.overview.topCategories}</Text>
                  <PressableScale testID="overview-stats-link" onPress={() => router.push("/stats")}>
                    <Text style={styles.link}>{vi.overview.statsLink}</Text>
                  </PressableScale>
                </View>
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
              </Animated.View>
            ) : null}

            <Animated.View style={styles.card} testID="overview-recent" {...fade}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle}>{vi.overview.recent}</Text>
                <PressableScale testID="overview-see-all" onPress={() => router.push("/history")}>
                  <Text style={styles.link}>{vi.overview.seeAll}</Text>
                </PressableScale>
              </View>
              <View testID="overview-recent-list">
                {data && !data.hasAny ? <Text style={styles.empty}>{vi.overview.empty}</Text> : null}
                {data?.recent.map((t) => (
                  <PressableScale
                    key={t.id}
                    testID={`overview-open-${t.id}`}
                    onPress={() => router.push(`/transaction/${t.id}`)}
                  >
                    <TransactionListItem txn={t} categoryName={data.categoryNames[t.category_id] ?? ""} />
                  </PressableScale>
                ))}
              </View>
            </Animated.View>
          </>
        )}
      </ScrollView>
      <PressableScale
        testID="overview-add-button"
        accessibilityRole="button"
        accessibilityLabel={vi.overview.add}
        onPress={() => setMenuOpen(true)}
        style={styles.fab}
      >
        <PlusIcon color={colors.primary} size={24} />
      </PressableScale>
      <SheetPicker
        visible={pickerOpen}
        title={vi.stats.monthPickerTitle}
        options={months.map((m) => ({
          key: m,
          label: vi.stats.monthOption(monthNumber(m), m.slice(0, 4)),
          testID: `overview-pick-month-${m}`,
        }))}
        selectedKey={data?.month ?? null}
        onSelect={(m) => {
          setPickedMonth(m);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
      <EntryMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onManual={() => {
          setMenuOpen(false);
          router.push("/transaction/new");
        }}
        onVoice={() => {
          setMenuOpen(false);
          router.push("/voice");
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 56, backgroundColor: colors.background },
  scroll: { paddingHorizontal: layout.screenPadding, paddingBottom: 96, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headerText: { gap: 2 },
  greeting: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.textMuted },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.heading, color: colors.text },
  monthButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.text,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
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
