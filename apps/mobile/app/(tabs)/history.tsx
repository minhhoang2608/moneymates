import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { FilterChips, type Chip } from "@/components/history/FilterChips";
import { HistoryRow } from "@/components/history/HistoryRow";
import { SwipeableRow } from "@/components/history/SwipeableRow";
import { UndoSnackbar } from "@/components/history/UndoSnackbar";
import { SheetPicker, type SheetOption } from "@/components/transaction/SheetPicker";
import { useRepositories } from "@/db/RepositoriesProvider";
import type { TransactionRow } from "@/db/repositories";
import { vi } from "@/i18n/vi";
import {
  defaultFilters,
  groupByDay,
  isFiltered,
  monthNumber,
  recentMonths,
  toTransactionFilter,
  type HistoryFilters,
} from "@/lib/history";
import { formatVnd } from "@/lib/money";
import { colors, fontFamily, fontSize, layout, radii } from "@/theme";

const ALL = "__all__";
type Picker = "month" | "category" | "source" | null;

export default function HistoryScreen() {
  const router = useRouter();
  const { transactions, categories } = useRepositories();
  const [filters, setFilters] = useState<HistoryFilters>(() => defaultFilters());
  const [rows, setRows] = useState<TransactionRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [names, setNames] = useState<Record<string, string>>({});
  const [allCategories, setAllCategories] = useState<{ id: string; name: string }[]>([]);
  const [picker, setPicker] = useState<Picker>(null);
  const [deleted, setDeleted] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      void version; // reload after delete / undo
      Promise.all([
        transactions.list(toTransactionFilter(filters)),
        categories.listByKind("expense"),
        categories.listByKind("income"),
      ]).then(([list, exp, inc]) => {
        if (!alive) return;
        const cats = [...exp, ...inc];
        setRows(list);
        setAllCategories(cats);
        setNames(Object.fromEntries(cats.map((c) => [c.id, c.name])));
        setLoaded(true);
      });
      return () => {
        alive = false;
      };
    }, [transactions, categories, filters, version]),
  );

  const groups = useMemo(() => groupByDay(rows), [rows]);
  const patch = (p: Partial<HistoryFilters>) => setFilters((f) => ({ ...f, ...p }));
  const hideSnackbar = useCallback(() => setDeleted(null), []);

  const remove = async (id: string) => {
    await transactions.softDelete(id);
    setDeleted(id);
    setVersion((v) => v + 1);
  };
  const undo = async () => {
    if (!deleted) return;
    await transactions.restore(deleted);
    setDeleted(null);
    setVersion((v) => v + 1);
  };

  const now = new Date();
  const customized = JSON.stringify(filters) !== JSON.stringify(defaultFilters(now));
  const months = recentMonths(now);
  const nextType = { null: "expense", expense: "income", income: null } as const;
  const chips: Chip[] = [
    {
      key: "month",
      label: `${filters.month ? vi.history.month(monthNumber(filters.month)) : vi.history.allMonths} ▾`,
      active: filters.month !== null,
      onPress: () => setPicker("month"),
    },
    {
      key: "category",
      label: `${filters.categoryId ? (names[filters.categoryId] ?? vi.history.category) : vi.history.category} ▾`,
      active: filters.categoryId !== null,
      onPress: () => setPicker("category"),
    },
    {
      key: "source",
      label: `${filters.moneySource ?? vi.history.moneySource} ▾`,
      active: filters.moneySource !== null,
      onPress: () => setPicker("source"),
    },
    {
      key: "type",
      label: filters.type ? vi.history[filters.type] : vi.history.typeAll,
      active: filters.type !== null,
      onPress: () => patch({ type: nextType[String(filters.type) as keyof typeof nextType] }),
    },
  ];

  const allOption: SheetOption = { key: ALL, label: vi.history.all, testID: "history-pick-all" };
  const pickerConfig = {
    month: {
      title: vi.history.monthTitle,
      options: [
        allOption,
        ...months.map((m) => ({
          key: m,
          label: `${vi.history.month(monthNumber(m))} / ${m.slice(0, 4)}`,
          testID: `history-pick-month-${m}`,
        })),
      ],
      selected: filters.month,
      apply: (k: string) => patch({ month: k === ALL ? null : k }),
    },
    category: {
      title: vi.history.category,
      options: [
        allOption,
        ...allCategories.map((c) => ({ key: c.id, label: c.name, testID: `history-pick-category-${c.id}` })),
      ],
      selected: filters.categoryId,
      apply: (k: string) => patch({ categoryId: k === ALL ? null : k }),
    },
    source: {
      title: vi.history.moneySource,
      options: [
        allOption,
        ...vi.moneySources.map((s, i) => ({ key: s, label: s, testID: `history-pick-source-${i}` })),
      ],
      selected: filters.moneySource,
      apply: (k: string) => patch({ moneySource: k === ALL ? null : k }),
    },
  };
  const active = picker ? pickerConfig[picker] : null;

  return (
    <View style={styles.root} testID="screen-history">
      <Text style={styles.title}>{vi.history.title}</Text>
      <TextInput
        testID="history-search"
        style={styles.search}
        placeholder={vi.history.searchPlaceholder}
        placeholderTextColor={colors.textMuted}
        value={filters.search}
        onChangeText={(search) => patch({ search })}
        autoCorrect={false}
      />
      <FilterChips
        chips={chips}
        showClear={isFiltered(filters)}
        onClear={() => setFilters({ month: null, categoryId: null, moneySource: null, type: null, search: "" })}
      />
      <ScrollView contentContainerStyle={styles.list} testID="history-list">
        {loaded && groups.length === 0 ? (
          <Text style={styles.empty} testID="history-empty">
            {customized ? vi.history.noMatch : vi.history.empty}
          </Text>
        ) : null}
        {groups.map((g) => (
          <View key={g.dayKey} testID={`history-day-${g.dayKey}`}>
            <View style={styles.dayHeader}>
              <Text style={styles.dayLabel}>{g.label}</Text>
              <Text style={styles.dayTotal}>
                {[
                  g.expenseTotal > 0 ? `${vi.history.expense} ${formatVnd(g.expenseTotal)}` : null,
                  g.incomeTotal > 0 ? `${vi.history.income} ${formatVnd(g.incomeTotal)}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>
            {g.rows.map((t) => (
              <SwipeableRow key={t.id} id={t.id} onDelete={() => void remove(t.id)}>
                <Pressable testID={`history-open-${t.id}`} onPress={() => router.push(`/transaction/${t.id}`)}>
                  <HistoryRow txn={t} categoryName={names[t.category_id] ?? ""} />
                </Pressable>
              </SwipeableRow>
            ))}
          </View>
        ))}
      </ScrollView>
      {deleted ? <UndoSnackbar token={deleted} onUndo={() => void undo()} onHide={hideSnackbar} /> : null}
      <SheetPicker
        visible={active !== null}
        title={active?.title ?? ""}
        options={active?.options ?? []}
        selectedKey={active?.selected ?? ALL}
        onSelect={(k) => {
          active?.apply(k);
          setPicker(null);
        }}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 56, paddingHorizontal: layout.screenPadding, backgroundColor: colors.background },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.heading, color: colors.text },
  search: {
    marginTop: 12,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: radii.input,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.text,
  },
  list: { paddingBottom: 96 },
  dayHeader: { flexDirection: "row", justifyContent: "space-between", paddingTop: 14, paddingBottom: 6 },
  dayLabel: { fontFamily: fontFamily.semibold, fontSize: fontSize.secondary, color: colors.textMuted },
  dayTotal: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
  empty: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textMuted, paddingVertical: 24 },
});
