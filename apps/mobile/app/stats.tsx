import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/PressableScale";
import Svg, { Circle, G } from "react-native-svg";

import { SheetPicker } from "@/components/transaction/SheetPicker";
import { useRepositories } from "@/db/RepositoriesProvider";
import { vi } from "@/i18n/vi";
import { monthNumber, recentMonths } from "@/lib/history/filter";
import { formatVnd } from "@/lib/money";
import { formatMillions } from "@/lib/stats/formatMillions";
import { loadCategoryBreakdown, loadMonthlyTrend } from "@/lib/stats/loadStats";
import { monthKeyOf } from "@/lib/stats/monthKey";
import type { Breakdown } from "@/lib/stats/breakdown";
import type { TrendPoint } from "@/lib/stats/trend";
import { chartColors, colors, fontFamily, fontSize, layout, radii } from "@/theme";

type Kind = "expense" | "income";
const BAR_MAX = 100;
const colorAt = (i: number) => chartColors[Math.min(i, chartColors.length - 1)];

function Donut({ breakdown }: { breakdown: Breakdown }) {
  const pcts = breakdown.items.map((item) => (item.amount / breakdown.total) * 100);
  return (
    <Svg width={132} height={132} viewBox="0 0 42 42">
      <G rotation={-90} origin="21, 21">
        {breakdown.items.map((item, i) => (
          <Circle
            key={item.category}
            cx={21}
            cy={21}
            r={15.9155}
            fill="none"
            stroke={colorAt(i)}
            strokeWidth={6}
            strokeDasharray={`${pcts[i]} ${100 - pcts[i]}`}
            strokeDashoffset={-pcts.slice(0, i).reduce((a, b) => a + b, 0)}
          />
        ))}
      </G>
    </Svg>
  );
}

export default function StatsScreen() {
  const router = useRouter();
  const repos = useRepositories();
  const [now] = useState(() => new Date());
  const months = useMemo(() => recentMonths(now), [now]);
  const [month, setMonth] = useState(() => monthKeyOf(now.toISOString()));
  const [kind, setKind] = useState<Kind>("expense");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      Promise.all([loadCategoryBreakdown(repos, month, kind), loadMonthlyTrend(repos, month)]).then(([b, t]) => {
        if (!alive) return;
        setBreakdown(b);
        setTrend(t);
      });
      return () => {
        alive = false;
      };
    }, [repos, month, kind]),
  );

  const empty = breakdown !== null && breakdown.total === 0;
  const trendMax = Math.max(1, ...trend.map((p) => p.total));

  return (
    <View style={styles.root} testID="screen-stats">
      <View style={styles.header}>
        <PressableScale
          testID="stats-back"
          accessibilityRole="button"
          accessibilityLabel={vi.stats.back}
          onPress={() => router.back()}
          style={styles.back}
        >
          <Text style={styles.backText}>‹</Text>
        </PressableScale>
        <Text style={styles.title}>{vi.stats.title}</Text>
        <PressableScale testID="stats-month-button" onPress={() => setPickerOpen(true)} style={styles.chip}>
          <Text style={styles.chipText}>{vi.stats.month(monthNumber(month))}</Text>
        </PressableScale>
      </View>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.segment} accessibilityRole="radiogroup">
          {(["expense", "income"] as const).map((k) => (
            <PressableScale
              key={k}
              testID={`stats-kind-${k}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: kind === k }}
              onPress={() => setKind(k)}
              style={[styles.segItem, kind === k && styles.segActive]}
            >
              <Text style={[styles.segText, kind === k && styles.segTextActive]}>{vi.stats[k]}</Text>
            </PressableScale>
          ))}
        </View>

        {empty ? (
          <Text style={styles.empty} testID="stats-empty">
            {vi.stats.empty}
          </Text>
        ) : null}

        {breakdown && !empty ? (
          <>
            <View style={styles.card} testID="stats-breakdown">
              <View style={styles.donutRow}>
                <View style={styles.donut}>
                  <Donut breakdown={breakdown} />
                  <View style={styles.donutCenter} pointerEvents="none">
                    <Text style={styles.donutLabel}>
                      {kind === "expense" ? vi.stats.totalExpense : vi.stats.totalIncome}
                    </Text>
                    <Text style={styles.donutTotal} testID="stats-total">
                      {formatVnd(breakdown.total)}
                    </Text>
                  </View>
                </View>
                <View style={styles.legend}>
                  {breakdown.items.map((item, i) => (
                    <View key={item.category} style={styles.legendRow} testID={`stats-category-${i}`}>
                      <View style={[styles.dot, { backgroundColor: colorAt(i) }]} />
                      <Text style={styles.legendName}>{item.category}</Text>
                      <Text style={styles.legendAmount}>{formatVnd(item.amount)}</Text>
                      <Text style={styles.legendPct}>{Math.round((item.amount * 100) / breakdown.total)}%</Text>
                    </View>
                  ))}
                </View>
              </View>
              {kind === "expense" && breakdown.groupShareTotal > 0 ? (
                <Text style={styles.note} testID="stats-group-share">
                  {vi.stats.groupShare(formatVnd(breakdown.groupShareTotal))}
                </Text>
              ) : null}
            </View>

            <View style={styles.card} testID="stats-trend">
              <View style={styles.trendHead}>
                <Text style={styles.cardTitle}>{vi.stats.trendTitle}</Text>
                <Text style={styles.note}>{vi.stats.trendUnit}</Text>
              </View>
              <View style={styles.bars}>
                {trend.map((p, i) => (
                  <View key={p.month} style={styles.barCol}>
                    <Text style={styles.barValue}>{formatMillions(p.total)}</Text>
                    <View
                      testID={`stats-trend-bar-${i}`}
                      style={[
                        styles.bar,
                        {
                          height: Math.round((p.total / trendMax) * BAR_MAX),
                          backgroundColor: p.month === month ? colors.primary : colors.primarySoft2,
                        },
                      ]}
                    />
                  </View>
                ))}
              </View>
              <View style={styles.bars}>
                {trend.map((p) => (
                  <Text key={p.month} style={styles.barLabel}>
                    {vi.stats.monthLabel(monthNumber(p.month))}
                  </Text>
                ))}
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
      <SheetPicker
        visible={pickerOpen}
        title={vi.stats.monthPickerTitle}
        options={months.map((m) => ({
          key: m,
          label: vi.stats.monthOption(monthNumber(m), m.slice(0, 4)),
          testID: `stats-pick-month-${m}`,
        }))}
        selectedKey={month}
        onSelect={(k) => {
          setMonth(k);
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 40, backgroundColor: colors.background },
  header: { height: 64, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  backText: { fontFamily: fontFamily.bold, fontSize: 28, color: colors.text },
  title: { flex: 1, fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: colors.text },
  chip: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  chipText: { fontFamily: fontFamily.semibold, fontSize: fontSize.secondary, color: colors.text },
  scroll: { paddingHorizontal: layout.screenPadding, paddingBottom: 24, gap: 14 },
  segment: { flexDirection: "row", gap: 4, backgroundColor: colors.segmentBg, borderRadius: 12, padding: 4 },
  segItem: { flex: 1, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  segActive: { backgroundColor: colors.surface },
  segText: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textMuted },
  segTextActive: { fontFamily: fontFamily.semibold, color: colors.text },
  card: { backgroundColor: colors.surface, borderRadius: radii.card, padding: 16, gap: 14 },
  cardTitle: { fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: colors.text },
  donutRow: { gap: 16, alignItems: "center" },
  donut: { width: 132, height: 132 },
  donutCenter: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },
  donutLabel: { fontFamily: fontFamily.regular, fontSize: 11, color: colors.textMuted },
  donutTotal: { fontFamily: fontFamily.bold, fontSize: 12, color: colors.text, textAlign: "center" },
  legend: { alignSelf: "stretch", gap: 8 },
  legendRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 3 },
  legendName: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.text },
  legendAmount: { fontFamily: fontFamily.semibold, fontSize: fontSize.secondary, color: colors.text },
  legendPct: {
    width: 40,
    textAlign: "right",
    fontFamily: fontFamily.regular,
    fontSize: fontSize.secondary,
    color: colors.textMuted,
  },
  note: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
  trendHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  bars: { flexDirection: "row", gap: 14, alignItems: "flex-end" },
  barCol: { flex: 1, alignItems: "center", gap: 4, justifyContent: "flex-end", height: BAR_MAX + 20 },
  bar: { width: "100%", borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  barValue: { fontFamily: fontFamily.regular, fontSize: 11, color: colors.textMuted },
  barLabel: { flex: 1, textAlign: "center", fontFamily: fontFamily.regular, fontSize: 11, color: colors.textMuted },
  empty: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.textMuted,
    paddingVertical: 24,
    textAlign: "center",
  },
});
