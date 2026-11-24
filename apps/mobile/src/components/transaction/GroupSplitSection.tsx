import { StyleSheet, Text, TextInput, View } from "react-native";
import { PressableScale } from "@/components/PressableScale";

import type { GroupMember } from "@/db/repositories";
import { vi } from "@/i18n/vi";
import { formatVnd } from "@/lib/money";
import type { DraftMode, SplitDraft } from "@/lib/group/splitDraft";
import { colors, fontFamily, fontSize, radii } from "@/theme";

type Props = {
  members: GroupMember[];
  payerId: string | null;
  onPayer: (id: string) => void;
  mode: DraftMode;
  onMode: (m: DraftMode) => void;
  ticked: Set<string>;
  onToggle: (id: string) => void;
  amountInputs: Record<string, string>;
  percentInputs: Record<string, string>;
  onAmountInput: (id: string, text: string) => void;
  onPercentInput: (id: string, text: string) => void;
  draft: SplitDraft;
};

const bpText = (bp: number) => {
  const whole = Math.floor(bp / 100);
  const frac = bp % 100;
  return frac === 0 ? String(whole) : `${whole},${String(frac).padStart(2, "0").replace(/0$/, "")}`;
};

function statusText(draft: SplitDraft): string | null {
  const s = draft.status;
  switch (s.kind) {
    case "short":
      return vi.groupSplit.short(formatVnd(s.diff));
    case "over":
      return vi.groupSplit.over(formatVnd(s.diff));
    case "percentNot100":
      return s.over ? vi.groupSplit.percentOver(bpText(s.diffBp)) : vi.groupSplit.percentShort(bpText(s.diffBp));
    case "noMembers":
      return vi.groupSplit.noMembers;
    case "invalidValue":
      return vi.groupSplit.invalidValue;
    default:
      return null;
  }
}

export function GroupSplitSection(p: Props) {
  const modes: { key: DraftMode; label: string }[] = [
    { key: "equal", label: vi.groupSplit.equal },
    { key: "amount", label: vi.groupSplit.byAmount },
    { key: "percent", label: vi.groupSplit.byPercent },
  ];
  const text = statusText(p.draft);
  const n = p.ticked.size;
  const perPerson = p.draft.ok && p.mode === "equal" ? p.draft.preview[0]?.amount : undefined;
  const summary =
    p.mode === "equal"
      ? perPerson !== undefined
        ? `${vi.groupSplit.equalSummary(n)} · ${vi.groupSplit.perPerson(formatVnd(perPerson))}`
        : vi.groupSplit.equalSummary(n)
      : modes.find((m) => m.key === p.mode)!.label;

  return (
    <View style={styles.wrap}>
      <View style={styles.card}>
        <Text style={styles.label}>{vi.groupSplit.payer}</Text>
        <View testID="payer-picker" style={styles.chips}>
          {p.members.map((m) => {
            const active = p.payerId === m.id;
            return (
              <PressableScale
                key={m.id}
                testID={`payer-${m.id}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => p.onPayer(m.id)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{m.displayName}</Text>
              </PressableScale>
            );
          })}
        </View>
      </View>

      <View style={styles.card}>
        <Text testID="split-summary" style={styles.summary}>
          {summary}
        </Text>
        <View style={styles.chips}>
          {modes.map((m) => {
            const active = p.mode === m.key;
            return (
              <PressableScale
                key={m.key}
                testID={`split-mode-${m.key}`}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => p.onMode(m.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{m.label}</Text>
              </PressableScale>
            );
          })}
        </View>

        {p.members.map((m) => {
          const on = p.ticked.has(m.id);
          return (
            <View key={m.id} style={styles.memberRow}>
              <PressableScale
                testID={`member-tick-${m.id}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on }}
                onPress={() => p.onToggle(m.id)}
                style={styles.memberTick}
              >
                <Text style={[styles.tickBox, on && styles.tickBoxOn]}>{on ? "✓" : ""}</Text>
                <Text style={styles.memberName}>{m.displayName}</Text>
              </PressableScale>
              {on && p.mode === "amount" ? (
                <TextInput
                  testID={`split-amount-${m.id}`}
                  value={p.amountInputs[m.id] ?? ""}
                  onChangeText={(t) => p.onAmountInput(m.id, t)}
                  placeholder={vi.groupSplit.amountPlaceholder}
                  placeholderTextColor={colors.neutral}
                  autoCapitalize="none"
                  style={styles.valueInput}
                />
              ) : null}
              {on && p.mode === "percent" ? (
                <TextInput
                  testID={`split-percent-${m.id}`}
                  value={p.percentInputs[m.id] ?? ""}
                  onChangeText={(t) => p.onPercentInput(m.id, t)}
                  placeholder={vi.groupSplit.percentPlaceholder}
                  placeholderTextColor={colors.neutral}
                  keyboardType="decimal-pad"
                  style={styles.valueInput}
                />
              ) : null}
              {on && p.mode === "equal" && p.draft.ok ? (
                <Text style={styles.memberAmount}>
                  {formatVnd(p.draft.preview.find((x) => x.memberId === m.id)?.amount ?? 0)}
                </Text>
              ) : null}
            </View>
          );
        })}
        {text ? (
          <Text testID="split-status" style={styles.status}>
            {text}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  label: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.textMuted },
  summary: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.text },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 36,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  chipActive: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.text },
  chipTextActive: { fontFamily: fontFamily.semibold, color: colors.primaryDark },
  memberRow: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  memberTick: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  tickBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: colors.border,
    textAlign: "center",
    lineHeight: 20,
    color: colors.onPrimary,
  },
  tickBoxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  memberName: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.text },
  memberAmount: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.text },
  valueInput: {
    width: 120,
    textAlign: "right",
    padding: 0,
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.body,
    color: colors.text,
  },
  status: { fontFamily: fontFamily.semibold, fontSize: fontSize.caption, color: colors.expense },
});
