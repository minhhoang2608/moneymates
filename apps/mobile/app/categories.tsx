import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { PressableScale } from "@/components/PressableScale";

import { CategoryEditSheet, type CategoryDraft } from "@/components/category/CategoryEditSheet";
import { CategoryRow } from "@/components/category/CategoryRow";
import { CategoryTile } from "@/components/category/CategoryTile";
import { useRepositories } from "@/db/RepositoriesProvider";
import type { CategoryRow as Row } from "@/db/repositories";
import { vi } from "@/i18n/vi";
import type { CategoryKind } from "@/lib/category/types";
import { colors, fontFamily, fontSize, layout, radii } from "@/theme";

type Sheet = { item: Row | null } | null;

export default function CategoriesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { categories } = useRepositories();
  const [kind, setKind] = useState<CategoryKind>("expense");
  const [items, setItems] = useState<Row[]>([]);
  const [sheet, setSheet] = useState<Sheet>(null);

  const reload = useCallback(async () => {
    setItems(await categories.listByKind(kind));
  }, [categories, kind]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      categories.listByKind(kind).then((rows) => alive && setItems(rows));
      return () => {
        alive = false;
      };
    }, [categories, kind]),
  );

  const defaults = items.filter((c) => c.is_default);
  const custom = items.filter((c) => !c.is_default);

  async function save(draft: CategoryDraft) {
    if (sheet?.item) await categories.update(sheet.item.id, draft);
    else await categories.create({ ...draft, kind });
    setSheet(null);
    await reload();
  }

  function confirmDelete(item: Row) {
    Alert.alert(vi.categories.deleteTitle, vi.categories.deleteMessage, [
      { text: vi.categories.cancel, style: "cancel" },
      {
        text: vi.categories.delete,
        style: "destructive",
        onPress: async () => {
          await categories.deleteCategory(item.id);
          setSheet(null);
          await reload();
        },
      },
    ]);
  }

  return (
    <View style={styles.root} testID="screen-categories">
      <View testID="categories-header" style={[styles.header, { paddingTop: insets.top, height: 64 + insets.top }]}>
        <PressableScale
          testID="category-back"
          accessibilityRole="button"
          accessibilityLabel={vi.categories.back}
          onPress={() => router.back()}
          style={styles.iconBtn}
        >
          <Text style={styles.back}>‹</Text>
        </PressableScale>
        <Text style={styles.title}>{vi.categories.title}</Text>
        <PressableScale
          testID="category-add"
          accessibilityRole="button"
          accessibilityLabel={vi.categories.add}
          onPress={() => setSheet({ item: null })}
          style={styles.iconBtn}
        >
          <Text style={styles.plus}>+</Text>
        </PressableScale>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.segment} accessibilityRole="radiogroup" accessibilityLabel={vi.categories.kindLabel}>
          {(["expense", "income"] as const).map((k) => (
            <PressableScale
              key={k}
              testID={`category-tab-${k}`}
              accessibilityRole="radio"
              accessibilityState={{ checked: kind === k }}
              onPress={() => setKind(k)}
              style={[styles.segBtn, kind === k && styles.segOn]}
            >
              <Text style={[styles.segText, kind === k && styles.segTextOn]}>{vi.categories[k]}</Text>
            </PressableScale>
          ))}
        </View>
        <Text style={styles.section}>{vi.categories.defaults}</Text>
        <View style={styles.grid}>
          {defaults.map((c) => (
            <CategoryTile key={c.id} item={c} onPress={() => setSheet({ item: c })} />
          ))}
        </View>
        <Text style={styles.section}>{vi.categories.custom}</Text>
        <View style={styles.card}>
          {custom.length === 0 ? <Text style={styles.empty}>{vi.categories.customEmpty}</Text> : null}
          {custom.map((c, i) => (
            <CategoryRow
              key={c.id}
              item={c}
              last={i === custom.length - 1}
              onEdit={() => setSheet({ item: c })}
              onDelete={() => confirmDelete(c)}
            />
          ))}
        </View>
        <Text style={styles.note}>{vi.categories.note}</Text>
      </ScrollView>
      {sheet ? (
        <CategoryEditSheet
          key={sheet.item?.id ?? "new"}
          item={sheet.item}
          onSave={save}
          onDelete={() => sheet.item && confirmDelete(sheet.item)}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { height: 64, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  back: { fontSize: 30, color: colors.text },
  plus: { fontSize: 28, color: colors.primary },
  title: { flex: 1, fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: colors.text },
  body: { paddingHorizontal: layout.screenPadding, gap: 14, paddingBottom: 32 },
  segment: { flexDirection: "row", gap: 4, backgroundColor: colors.segmentBg, borderRadius: radii.input, padding: 4 },
  segBtn: { flex: 1, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  segOn: { backgroundColor: colors.surface },
  segText: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textMuted },
  segTextOn: { fontFamily: fontFamily.semibold, color: colors.text },
  section: { fontFamily: fontFamily.semibold, fontSize: fontSize.secondary, color: colors.textMuted },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: { backgroundColor: colors.surface, borderRadius: radii.card, paddingHorizontal: 16 },
  empty: { paddingVertical: 16, fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textMuted },
  note: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
});
