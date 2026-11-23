import { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { useRepositories } from "@/db/RepositoriesProvider";
import type { CategoryRow, GroupMember } from "@/db/repositories";
import { vi } from "@/i18n/vi";
import { evaluateSplitDraft, type DraftMode } from "@/lib/group/splitDraft";
import { formatVnd, parseAmount } from "@/lib/money";
import { formatTxnDateLabel, validateForm, type FormErrors, type FormType } from "@/lib/transaction/form";
import { photoPicker as defaultPhotoPicker, type PhotoPicker } from "@/lib/photoPicker";
import { colors, fontFamily, fontSize, radii } from "@/theme";

import { CategoryPicker } from "./CategoryPicker";
import { DateTimeField } from "./DateTimeField";
import { GroupSplitSection } from "./GroupSplitSection";
import { MoneySourcePicker } from "./MoneySourcePicker";

type Props = {
  /** Edit mode when set; otherwise creates a new transaction. */
  transactionId?: string;
  /** Group expense mode: payer + split section, saves through groupExpenses. */
  groupId?: string;
  onClose: () => void;
  onSaved?: () => void;
  photoPicker?: PhotoPicker;
};

export function TransactionForm({ transactionId, groupId, onClose, onSaved, photoPicker = defaultPhotoPicker }: Props) {
  const { transactions, categories, groups, groupExpenses } = useRepositories();
  const isGroup = !!groupId && !transactionId;
  const [type, setType] = useState<FormType>("expense");
  const [amountText, setAmountText] = useState("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => new Date());
  const [moneySource, setMoneySource] = useState<string>(vi.moneySources[0]);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [saveFailed, setSaveFailed] = useState(false);
  const [list, setList] = useState<CategoryRow[]>([]);
  const [allCategories, setAllCategories] = useState<CategoryRow[]>([]);
  const [sheet, setSheet] = useState<null | "category" | "source" | "time">(null);
  const [loaded, setLoaded] = useState(!transactionId);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [payerId, setPayerId] = useState<string | null>(null);
  const [splitMode, setSplitMode] = useState<DraftMode>("equal");
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [amountInputs, setAmountInputs] = useState<Record<string, string>>({});
  const [percentInputs, setPercentInputs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isGroup || !groupId) return;
    let alive = true;
    groups.getGroup(groupId).then((g) => {
      if (!alive) return;
      setMembers(g.members);
      setPayerId((g.members.find((m) => m.isMe) ?? g.members[0])?.id ?? null);
      setTicked(new Set(g.members.map((m) => m.id)));
    });
    return () => {
      alive = false;
    };
  }, [groups, groupId, isGroup]);

  useEffect(() => {
    let alive = true;
    categories.listByKind(type).then((rows) => alive && setList(rows));
    return () => {
      alive = false;
    };
  }, [categories, type]);

  useEffect(() => {
    let alive = true;
    Promise.all([categories.listByKind("expense"), categories.listByKind("income")]).then(
      ([a, b]) => alive && setAllCategories([...a, ...b]),
    );
    return () => {
      alive = false;
    };
  }, [categories]);

  useEffect(() => {
    if (!transactionId) return;
    let alive = true;
    transactions.getById(transactionId).then((t) => {
      if (!alive) return;
      if (t) {
        setType(t.type);
        setAmountText(String(t.amount));
        setCategoryId(t.category_id);
        setNote(t.note);
        setOccurredAt(new Date(t.occurred_at));
        setMoneySource(t.money_source);
        setPhotoUri(t.photo_uri);
      }
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [transactions, transactionId]);

  const parsed = parseAmount(amountText);
  const draft = evaluateSplitDraft({
    amount: parsed.ok ? parsed.vnd : null,
    mode: splitMode,
    members: members.map((m) => m.id),
    ticked,
    amountInputs,
    percentInputs,
  });
  const saveDisabled = isGroup && (!draft.ok || !payerId);
  const categoryName = allCategories.find((c) => c.id === categoryId)?.name;

  const changeType = (next: FormType) => {
    if (next === type) return;
    setType(next);
    setCategoryId(null);
    setErrors((e) => ({ ...e, category: undefined }));
  };

  const save = async () => {
    if (saveDisabled) return;
    const result = validateForm({ type, amountText, categoryId, note, occurredAt, moneySource, photoUri });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    setSaveFailed(false);
    try {
      if (isGroup && groupId && payerId) {
        await groupExpenses.createGroupExpense({
          groupId,
          amount: result.input.amount,
          payerMemberId: payerId,
          splitMode,
          shares: draft.shares,
          occurredAt: result.input.occurred_at,
          categoryId: result.input.category_id,
          note: result.input.note,
        });
      } else if (transactionId) await transactions.update(transactionId, result.input);
      else await transactions.create({ ...result.input, source: "manual" });
      onSaved?.();
      onClose();
    } catch {
      setSaveFailed(true);
    }
  };

  const pickPhoto = async () => {
    const uri = await photoPicker.pick();
    if (uri) setPhotoUri(uri);
  };

  if (!loaded) return null;

  return (
    <View style={styles.root} testID="transaction-form">
      <View style={styles.header}>
        <Pressable
          testID="close-button"
          accessibilityRole="button"
          accessibilityLabel={vi.txn.close}
          onPress={onClose}
          style={styles.close}
        >
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
        <Text style={styles.headerTitle}>{transactionId ? vi.txn.editTitle : vi.txn.addTitle}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {isGroup ? null : (
          <View accessibilityRole="radiogroup" accessibilityLabel={vi.txn.typeLabel} style={styles.segment}>
            {(["expense", "income"] as const).map((t) => {
              const active = type === t;
              return (
                <Pressable
                  key={t}
                  testID={`type-${t}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  onPress={() => changeType(t)}
                  style={[styles.segmentItem, active && styles.segmentActive]}
                >
                  <Text
                    style={[
                      styles.segmentText,
                      active && {
                        fontFamily: fontFamily.semibold,
                        color: t === "expense" ? colors.expense : colors.primary,
                      },
                    ]}
                  >
                    {t === "expense" ? vi.txn.expense : vi.txn.income}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.modes}>
          <View style={[styles.mode, styles.modeActive]}>
            <Text style={[styles.modeText, { fontFamily: fontFamily.semibold, color: colors.primaryDark }]}>
              {vi.txn.modeManual}
            </Text>
          </View>
          {[vi.txn.modeVoice, vi.txn.modeBill].map((label) => (
            <View key={label} style={[styles.mode, styles.modeDisabled]} accessibilityState={{ disabled: true }}>
              <Text style={[styles.modeText, { color: colors.neutral }]}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>{vi.txn.amount}</Text>
          <TextInput
            testID="amount-input"
            value={amountText}
            onChangeText={(t) => {
              setAmountText(t);
              if (errors.amount) setErrors((e) => ({ ...e, amount: undefined }));
            }}
            placeholder="0"
            placeholderTextColor={colors.neutral}
            autoCapitalize="none"
            style={[styles.amountInput, errors.amount && styles.inputError]}
          />
          {errors.amount ? (
            <Text testID="amount-error" style={styles.error}>
              {vi.txn.amountError}
            </Text>
          ) : (
            <Text testID="amount-preview" style={styles.hint}>
              {`= ${parsed.ok ? formatVnd(parsed.vnd) : "0đ"} · ${vi.txn.amountHint}`}
            </Text>
          )}
        </View>

        {isGroup ? (
          <GroupSplitSection
            members={members}
            payerId={payerId}
            onPayer={setPayerId}
            mode={splitMode}
            onMode={setSplitMode}
            ticked={ticked}
            onToggle={(id) =>
              setTicked((prev) => {
                const next = new Set(prev);
                if (next.has(id)) next.delete(id);
                else next.add(id);
                return next;
              })
            }
            amountInputs={amountInputs}
            percentInputs={percentInputs}
            onAmountInput={(id, t) => setAmountInputs((v) => ({ ...v, [id]: t }))}
            onPercentInput={(id, t) => setPercentInputs((v) => ({ ...v, [id]: t }))}
            draft={draft}
          />
        ) : null}

        <View style={[styles.card, styles.listCard]}>
          <Pressable
            testID="category-row"
            accessibilityRole="button"
            onPress={() => setSheet("category")}
            style={styles.row}
          >
            <Text style={styles.rowLabel}>{vi.txn.category}</Text>
            <Text style={[styles.rowValue, errors.category && { color: colors.expense }]}>
              {`${categoryName ?? (errors.category ? vi.txn.categoryError : vi.txn.categoryChoose)} ›`}
            </Text>
          </Pressable>
          <View style={styles.row}>
            <Text style={styles.rowLabel}>{vi.txn.note}</Text>
            <TextInput testID="note-input" value={note} onChangeText={setNote} style={styles.noteInput} />
          </View>
          <Pressable
            testID="datetime-row"
            accessibilityRole="button"
            onPress={() => setSheet("time")}
            style={styles.row}
          >
            <Text style={styles.rowLabel}>{vi.txn.time}</Text>
            <Text style={styles.rowValue}>{`${formatTxnDateLabel(occurredAt, new Date())} ›`}</Text>
          </Pressable>
          {isGroup ? null : (
            <Pressable
              testID="money-source-row"
              accessibilityRole="button"
              onPress={() => setSheet("source")}
              style={styles.row}
            >
              <Text style={styles.rowLabel}>{vi.txn.moneySource}</Text>
              <Text style={styles.rowValue}>{`${moneySource} ›`}</Text>
            </Pressable>
          )}
          <Pressable
            testID="photo-row"
            accessibilityRole="button"
            onPress={pickPhoto}
            style={[styles.row, styles.lastRow]}
          >
            <Text style={styles.rowLabel}>{vi.txn.photo}</Text>
            {photoUri ? (
              <Image testID="photo-thumbnail" source={{ uri: photoUri }} style={styles.thumb} />
            ) : (
              <Text style={styles.rowValue}>{`${vi.txn.photoAdd} ›`}</Text>
            )}
          </Pressable>
        </View>
        {saveFailed ? (
          <Text testID="save-error" style={styles.error}>
            {vi.txn.saveError}
          </Text>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          testID="save-button"
          accessibilityRole="button"
          accessibilityState={{ disabled: saveDisabled }}
          onPress={save}
          style={[styles.save, saveDisabled && styles.saveDisabled]}
        >
          <Text style={styles.saveText}>{vi.txn.save}</Text>
        </Pressable>
      </View>

      <CategoryPicker
        visible={sheet === "category"}
        categories={list}
        selectedId={categoryId}
        onSelect={(id) => {
          setCategoryId(id);
          setErrors((e) => ({ ...e, category: undefined }));
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      <MoneySourcePicker
        visible={sheet === "source"}
        selected={moneySource}
        onSelect={(s) => {
          setMoneySource(s);
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
      {sheet === "time" ? (
        <DateTimeField value={occurredAt} onChange={setOccurredAt} onClose={() => setSheet(null)} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { height: 64, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  closeText: { fontSize: 20, color: colors.text },
  headerTitle: { flex: 1, fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: colors.text },
  body: { paddingHorizontal: 20, paddingBottom: 24, gap: 14 },
  segment: { flexDirection: "row", gap: 4, backgroundColor: colors.segmentBg, borderRadius: 12, padding: 4 },
  segmentItem: { flex: 1, height: 38, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textMuted },
  modes: { flexDirection: "row", gap: 8 },
  mode: { flex: 1, height: 44, borderRadius: 12, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  modeActive: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: colors.primarySoft },
  modeDisabled: { borderColor: colors.border, backgroundColor: colors.surface },
  modeText: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.card,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 4,
  },
  listCard: { paddingVertical: 4, gap: 0 },
  label: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.textMuted },
  amountInput: { padding: 0, fontFamily: fontFamily.bold, fontSize: 30, color: colors.text },
  inputError: { color: colors.expense },
  hint: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
  error: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.expense },
  row: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  lastRow: { borderBottomWidth: 0 },
  rowLabel: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textMuted },
  rowValue: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.text },
  noteInput: {
    width: 200,
    textAlign: "right",
    padding: 0,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.body,
    color: colors.text,
  },
  thumb: { width: 36, height: 36, borderRadius: 8 },
  footer: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  save: {
    height: 54,
    borderRadius: radii.button,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveDisabled: { backgroundColor: colors.neutral },
  saveText: { fontFamily: fontFamily.semibold, fontSize: 16, color: colors.onPrimary },
});
