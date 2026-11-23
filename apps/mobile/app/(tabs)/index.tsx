import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { EntryMenu } from "@/components/EntryMenu";
import { TransactionListItem } from "@/components/transaction/TransactionListItem";
import { useRepositories } from "@/db/RepositoriesProvider";
import type { TransactionRow } from "@/db/repositories";
import { vi } from "@/i18n/vi";
import { colors, fontFamily, fontSize, layout } from "@/theme";

const RECENT_LIMIT = 10;

export default function OverviewScreen() {
  const router = useRouter();
  const { transactions, categories } = useRepositories();
  const [menuOpen, setMenuOpen] = useState(false);
  const [recent, setRecent] = useState<TransactionRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      Promise.all([transactions.list(), categories.listByKind("expense"), categories.listByKind("income")]).then(
        ([rows, exp, inc]) => {
          if (!alive) return;
          setRecent(rows.slice(0, RECENT_LIMIT));
          setNames(Object.fromEntries([...exp, ...inc].map((c) => [c.id, c.name])));
        },
      );
      return () => {
        alive = false;
      };
    }, [transactions, categories]),
  );

  return (
    <View style={styles.root} testID="screen-overview">
      <View style={styles.header}>
        <Text style={styles.title}>{vi.tabs.overview}</Text>
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
      <Text style={styles.section}>{vi.overview.recent}</Text>
      <ScrollView testID="overview-recent-list" contentContainerStyle={styles.list}>
        {recent.length === 0 ? <Text style={styles.empty}>{vi.overview.empty}</Text> : null}
        {recent.map((t) => (
          <Pressable key={t.id} testID={`overview-open-${t.id}`} onPress={() => router.push(`/transaction/${t.id}`)}>
            <TransactionListItem txn={t} categoryName={names[t.category_id] ?? ""} />
          </Pressable>
        ))}
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
  root: { flex: 1, paddingTop: 56, paddingHorizontal: layout.screenPadding, backgroundColor: colors.background },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.heading, color: colors.text },
  add: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  addText: { fontFamily: fontFamily.bold, fontSize: 24, color: colors.onPrimary },
  section: { marginTop: 20, fontFamily: fontFamily.semibold, fontSize: fontSize.secondary, color: colors.textMuted },
  list: { paddingTop: 8, paddingBottom: 24 },
  empty: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textMuted, paddingVertical: 16 },
});
