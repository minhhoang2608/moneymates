import { useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import Svg, { Path } from "react-native-svg";

import { GroupGlyph } from "@/components/group/GroupIconTile";
import { vi } from "@/i18n/vi";
import { groupIconFor } from "@/lib/group/icons";
import { formatEndedOn, formatLastUsed, listTargets } from "@/lib/target";
import type { Target, TargetGroup } from "@/lib/target";
import { colors, fontFamily, fontSize, radii } from "@/theme";

const PERSON_PATH = "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8c0-3.3 3.1-6 7-6s7 2.7 7 6";

type GroupTarget = Extract<Target, { kind: "group" }>;

export type TargetPickerSheetProps = {
  visible: boolean;
  groups: TargetGroup[];
  lastUsedByGroup: Map<string, string>;
  now: Date;
  selected: Target | null;
  memberCounts?: Map<string, number>;
  onSelect: (t: Target) => void;
  onClose: () => void;
};

export function TargetPickerSheet({
  visible,
  groups,
  lastUsedByGroup,
  now,
  selected,
  memberCounts,
  onSelect,
  onClose,
}: TargetPickerSheetProps) {
  const [query, setQuery] = useState("");
  const select = (t: Target) => {
    setQuery("");
    onSelect(t);
  };
  const close = () => {
    setQuery("");
    onClose();
  };

  const rows = listTargets({ groups, lastUsedByGroup, now, query });
  const personal = rows.find((r) => r.kind === "personal");
  const active = rows.filter((r): r is GroupTarget => r.kind === "group" && !r.ended);
  const ended = rows.filter((r): r is GroupTarget => r.kind === "group" && r.ended);
  const endDateOf = (id: string) => groups.find((g) => g.id === id)?.end_date ?? null;

  const isSelected = (t: Target) =>
    selected !== null &&
    (t.kind === "personal"
      ? selected.kind === "personal"
      : selected.kind === "group" && selected.groupId === t.groupId);

  const groupRow = (t: GroupTarget) => {
    const icon = groupIconFor(t.icon);
    const count = memberCounts?.get(t.groupId);
    const last = lastUsedByGroup.get(t.groupId);
    const endDate = endDateOf(t.groupId);
    const parts: string[] = [];
    if (count !== undefined) parts.push(`${count} ${vi.target.members}`);
    if (t.ended && endDate) parts.push(formatEndedOn(endDate));
    else if (last) parts.push(`${vi.target.lastUsed} ${formatLastUsed(last, now)}`);
    return (
      <Row
        key={t.groupId}
        testID={`target-row-${t.groupId}`}
        title={t.name}
        subtitle={parts.join(" · ")}
        muted={t.ended}
        checked={isSelected(t)}
        onPress={() => select(t)}
        tile={
          <View style={[styles.tile, { backgroundColor: icon.bg }]}>
            <GroupGlyph path={icon.path} color={icon.fg} size={20} />
          </View>
        }
      />
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={styles.flex} onPress={close} accessibilityLabel={vi.target.close} />
        <View style={styles.sheet} testID="target-sheet">
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title}>{vi.target.pickerTitle}</Text>
            <Pressable
              testID="target-close"
              accessibilityRole="button"
              accessibilityLabel={vi.target.close}
              onPress={close}
              hitSlop={8}
            >
              <Text style={styles.close}>✕</Text>
            </Pressable>
          </View>
          <TextInput
            testID="target-search"
            style={styles.search}
            value={query}
            onChangeText={setQuery}
            placeholder={vi.target.search}
            placeholderTextColor={colors.textMuted}
            autoCorrect={false}
          />
          <ScrollView keyboardShouldPersistTaps="handled">
            {personal && (
              <Row
                testID="target-row-personal"
                title={vi.target.personal}
                subtitle={vi.target.personalHint}
                checked={isSelected(personal)}
                onPress={() => select(personal)}
                tile={
                  <View style={[styles.tile, { backgroundColor: colors.primarySoft }]}>
                    <Svg
                      width={20}
                      height={20}
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={colors.primary}
                      strokeWidth={1.8}
                      strokeLinecap="round"
                    >
                      <Path d={PERSON_PATH} />
                    </Svg>
                  </View>
                }
              />
            )}
            {active.length > 0 && <Text style={styles.section}>{vi.target.sectionGroups}</Text>}
            {active.map(groupRow)}
            {ended.length > 0 && <Text style={styles.section}>{vi.target.sectionEnded}</Text>}
            {ended.map(groupRow)}
            <Text style={styles.hint}>{vi.target.hint}</Text>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Row({
  testID,
  title,
  subtitle,
  tile,
  checked,
  muted,
  onPress,
}: {
  testID: string;
  title: string;
  subtitle: string;
  tile: React.ReactNode;
  checked: boolean;
  muted?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} style={[styles.row, muted && styles.muted]}>
      {tile}
      <View style={styles.flex}>
        <Text style={styles.rowTitle}>{title}</Text>
        {subtitle !== "" && <Text style={styles.rowSub}>{subtitle}</Text>}
      </View>
      {checked && <Text style={styles.check}>✓</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  sheet: {
    maxHeight: "80%",
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.sheet,
    borderTopRightRadius: radii.sheet,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  title: { fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: colors.text },
  close: { fontFamily: fontFamily.medium, fontSize: fontSize.title, color: colors.textMuted },
  search: {
    height: 44,
    borderRadius: radii.input,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.text,
    marginBottom: 8,
  },
  section: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.caption,
    color: colors.textMuted,
    marginTop: 14,
    marginBottom: 4,
  },
  row: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  muted: { opacity: 0.6 },
  tile: { width: 36, height: 36, borderRadius: radii.sm, alignItems: "center", justifyContent: "center" },
  rowTitle: { fontFamily: fontFamily.semibold, fontSize: fontSize.row, color: colors.text },
  rowSub: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
  check: { fontFamily: fontFamily.bold, fontSize: fontSize.title, color: colors.primary },
  hint: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.caption,
    color: colors.textMuted,
    marginTop: 16,
  },
});
