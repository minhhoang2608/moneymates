import { Pressable, StyleSheet, Text, View } from "react-native";

import type { CategoryRow } from "@/db/repositories";
import { tintFor } from "@/lib/category/palette";
import { colors, fontFamily, fontSize } from "@/theme";

export function CategoryBadge({ icon, color }: { icon: string; color: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: tintFor(color) }]}>
      <Text style={[styles.badgeText, { color }]}>{icon}</Text>
    </View>
  );
}

/** Default category: 3-column grid tile; only icon and colour can change. */
export function CategoryTile({ item, onPress }: { item: CategoryRow; onPress: () => void }) {
  return (
    <Pressable testID={`category-tile-${item.id}`} accessibilityRole="button" onPress={onPress} style={styles.tile}>
      <CategoryBadge icon={item.icon} color={item.color} />
      <Text style={styles.name}>{item.name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: "31.5%",
    height: 76,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  badge: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  badgeText: { fontFamily: fontFamily.bold, fontSize: fontSize.caption },
  name: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.text },
});
