import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Animated from "react-native-reanimated";

import { PressableScale } from "@/components/PressableScale";
import { SkeletonList } from "@/components/Skeleton";
import { Avatar } from "@/components/group/Avatar";
import { GroupGlyph } from "@/components/group/GroupIconTile";
import { useRepositories } from "@/db/RepositoriesProvider";
import type { GroupSummary } from "@/db/repositories";
import { vi } from "@/i18n/vi";
import { formatGroupDates, memberLabel } from "@/lib/group/format";
import { groupIconFor } from "@/lib/group/icons";
import { formatVnd } from "@/lib/money";
import { fadeInProps, useReduceMotion } from "@/lib/motion";
import { colors, fontFamily, fontSize, layout, radii } from "@/theme";

const t = vi.groups;

export default function GroupsScreen() {
  const router = useRouter();
  const reduceMotion = useReduceMotion();
  const { groups } = useRepositories();
  const [rows, setRows] = useState<GroupSummary[]>([]);
  const [loaded, setLoaded] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      groups.listGroups().then((r) => {
        if (!alive) return;
        setRows(r);
        setLoaded(true);
      });
      return () => {
        alive = false;
      };
    }, [groups]),
  );

  const create = () => router.push("/group/edit");

  return (
    <View style={styles.root} testID="screen-groups">
      <View style={styles.header}>
        <Text style={styles.title}>{vi.tabs.groups}</Text>
        <PressableScale testID="group-create" accessibilityRole="button" style={styles.createBtn} onPress={create}>
          <Text style={styles.createText}>+ {t.create}</Text>
        </PressableScale>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {!loaded && <SkeletonList testID="groups-skeleton" count={3} />}
        {loaded && rows.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{t.empty}</Text>
            <PressableScale testID="group-empty-create" style={styles.createBtn} onPress={create}>
              <Text style={styles.createText}>{t.create}</Text>
            </PressableScale>
          </View>
        )}
        {rows.map((g) => {
          const icon = groupIconFor(g.icon);
          return (
            <Animated.View key={g.id} {...fadeInProps(reduceMotion)}>
              <PressableScale
                testID={`group-card-${g.id}`}
                accessibilityRole="button"
                onPress={() => router.push({ pathname: "/group/[id]", params: { id: g.id } })}
                accessibilityLabel={`${g.name}, ${g.members.map(memberLabel).join(", ")}`}
                style={styles.card}
              >
                <View style={styles.top}>
                  <View style={[styles.tile, { backgroundColor: icon.bg }]}>
                    <GroupGlyph path={icon.path} color={icon.fg} />
                  </View>
                  <View style={styles.info}>
                    <Text style={styles.name}>{g.name}</Text>
                    <Text style={styles.meta}>
                      {g.members.length} {t.memberCount} · {formatGroupDates(g.start_date, g.end_date)}
                    </Text>
                  </View>
                  <Text style={styles.total}>{formatVnd(g.total)}</Text>
                </View>
                <View style={styles.bottom}>
                  {g.members.map((m, i) => (
                    <Avatar
                      key={m.id}
                      name={m.isMe ? m.displayName || t.me : m.displayName}
                      index={i}
                      size={28}
                      overlap={i > 0}
                    />
                  ))}
                </View>
              </PressableScale>
            </Animated.View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background, paddingTop: 20 },
  header: {
    paddingHorizontal: layout.screenPadding,
    paddingTop: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.heading, color: colors.text },
  createBtn: {
    height: 40,
    paddingHorizontal: 14,
    borderRadius: radii.input,
    backgroundColor: colors.primary,
    justifyContent: "center",
  },
  createText: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.onPrimary },
  body: { padding: layout.screenPadding, gap: 16, paddingBottom: layout.tabBarHeight + 24 },
  empty: { alignItems: "center", gap: 16, paddingTop: 48 },
  emptyText: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textMuted },
  card: { backgroundColor: colors.surface, borderRadius: radii.profileCard, padding: 16, gap: 12 },
  top: { flexDirection: "row", alignItems: "center", gap: 12 },
  tile: { width: 48, height: 48, borderRadius: radii.button, alignItems: "center", justifyContent: "center" },
  info: { flex: 1, gap: 2 },
  name: { fontFamily: fontFamily.semibold, fontSize: 16, color: colors.text },
  meta: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.textMuted },
  total: { fontFamily: fontFamily.bold, fontSize: fontSize.row, color: colors.text },
  bottom: { flexDirection: "row", borderTopWidth: 1, borderTopColor: colors.divider, paddingTop: 12 },
});
