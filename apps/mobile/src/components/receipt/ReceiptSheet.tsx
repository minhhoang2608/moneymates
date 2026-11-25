import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { AnimatedSheet } from "@/components/AnimatedSheet";
import { PressableScale } from "@/components/PressableScale";
import { useRepositories } from "@/db/RepositoriesProvider";
import { vi } from "@/i18n/vi";
import { formatVnd, parseAmount } from "@/lib/money";
import { saveReceiptTransaction, type ReceiptDeps, type ReceiptDraft } from "@/lib/receipt/apply";
import { useReceiptSheet, type ReceiptSheetState } from "@/stores/receiptSheet";
import { colors, fontFamily, fontSize } from "@/theme";

/** "0123456789" → "0123 4567 89" (groups of 4, 4, rest). */
export function groupAccount(n: string): string {
  return n.replace(/(\d{4})(?=\d)/g, "$1 ").trim();
}

function Row({ label, last, children }: { label: string; last?: boolean; children: React.ReactNode }) {
  return (
    <View style={[styles.row, last ? null : styles.rowLine]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.value}>{children}</View>
    </View>
  );
}

/** Bottom sheet shown over the current screen when a shared receipt matches no pending payment. */
export function ReceiptSheet({ onEdit }: { onEdit?: (draft: ReceiptDraft) => void }) {
  const current = useReceiptSheet((s) => s.current);
  const close = () => useReceiptSheet.getState().close();
  return (
    <AnimatedSheet
      visible={current !== null}
      onClose={close}
      variant="sheet"
      testID="receipt-sheet"
      backdropTestID="receipt-sheet-backdrop"
    >
      {current ? (
        <ReceiptSheetBody key={current.draft.uri + current.draft.occurredAt} current={current} onEdit={onEdit} />
      ) : null}
    </AnimatedSheet>
  );
}

function ReceiptSheetBody({ current, onEdit }: { current: ReceiptSheetState; onEdit?: (draft: ReceiptDraft) => void }) {
  const { transactions, categories } = useRepositories();
  const { draft, parsed } = current;
  const [amountText, setAmountText] = useState(draft.amount === null ? "" : String(draft.amount));
  const [recipient, setRecipient] = useState(draft.recipient);
  const [message, setMessage] = useState(draft.note);
  const [categoryName, setCategoryName] = useState<string>("");
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    categories
      .listByKind("expense")
      .then((rows) => {
        if (alive) setCategoryName(rows.find((c) => c.id === draft.categoryId)?.name ?? "");
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [draft.categoryId, categories]);

  const close = () => useReceiptSheet.getState().close();

  const amountEditable = draft.amount === null;
  const parsedAmount = amountEditable
    ? (() => {
        const r = parseAmount(amountText);
        return r.ok ? r.vnd : null;
      })()
    : draft.amount;
  const edited = (): ReceiptDraft => ({
    ...draft,
    amount: parsedAmount,
    recipient: recipient.trim(),
    note: message.trim() || recipient.trim(),
  });

  const save = async () => {
    try {
      await saveReceiptTransaction({ transactions } as unknown as ReceiptDeps, edited());
      close();
    } catch {
      setError(true);
    }
  };
  const edit = () => {
    const d = edited();
    close();
    onEdit?.(d);
  };

  const showAccount = parsed.accountNumber;
  return (
    <View style={styles.sheet} accessibilityViewIsModal>
      <View style={styles.handle} />
      <View style={styles.head}>
        <View style={styles.headText}>
          <Text style={styles.title}>{vi.receipt.sheetTitle}</Text>
          <Text style={styles.sub} testID="receipt-sheet-from">
            {parsed.bankName ? vi.receipt.from(parsed.bankName) : vi.receipt.fromUnknown}
          </Text>
        </View>
      </View>
      <View>
        <Row label={vi.receipt.amount}>
          {amountEditable ? (
            <TextInput
              testID="receipt-amount-input"
              style={styles.input}
              value={amountText}
              onChangeText={setAmountText}
              placeholder={vi.receipt.amountPlaceholder}
              placeholderTextColor={colors.textMuted}
              keyboardType="numbers-and-punctuation"
            />
          ) : (
            <Text style={styles.amount} testID="receipt-amount">
              {formatVnd(draft.amount as number)}
            </Text>
          )}
        </Row>
        <Row label={vi.receipt.recipient}>
          {parsed.recipient ? (
            <Text style={styles.valueText} testID="receipt-recipient">
              {parsed.recipient}
            </Text>
          ) : (
            <TextInput
              testID="receipt-recipient-input"
              style={styles.input}
              value={recipient}
              onChangeText={setRecipient}
              placeholder={vi.receipt.recipientPlaceholder}
              placeholderTextColor={colors.textMuted}
            />
          )}
        </Row>
        {showAccount ? (
          <Row label={vi.receipt.account}>
            <Text style={styles.valueText} testID="receipt-account">
              {[parsed.bankName, groupAccount(showAccount)].filter(Boolean).join(" · ")}
            </Text>
          </Row>
        ) : null}
        <Row label={vi.receipt.message} last>
          {parsed.message ? (
            <Text style={styles.valueText} testID="receipt-message">
              {parsed.message}
            </Text>
          ) : (
            <TextInput
              testID="receipt-message-input"
              style={styles.input}
              value={message}
              onChangeText={setMessage}
              placeholder={vi.receipt.messagePlaceholder}
              placeholderTextColor={colors.textMuted}
            />
          )}
        </Row>
      </View>
      <View style={styles.notice} accessibilityRole="summary">
        <Text style={styles.noticeText} testID="receipt-no-match">
          {vi.receipt.noMatch}
          <Text style={styles.bold}>{categoryName}</Text>.
        </Text>
      </View>
      {error ? (
        <Text style={styles.error} testID="receipt-error">
          {vi.receipt.saveError}
        </Text>
      ) : null}
      <View style={styles.buttons}>
        <PressableScale
          testID="receipt-edit"
          accessibilityRole="button"
          style={[styles.btn, styles.ghost]}
          onPress={edit}
        >
          <Text style={styles.ghostText}>{vi.receipt.edit}</Text>
        </PressableScale>
        <PressableScale
          testID="receipt-save"
          accessibilityRole="button"
          style={[styles.btn, styles.primary]}
          onPress={() => void save()}
        >
          <Text style={styles.primaryText}>{vi.receipt.save}</Text>
        </PressableScale>
      </View>
      <PressableScale testID="receipt-skip" accessibilityRole="button" style={styles.skip} onPress={close}>
        <Text style={styles.skipText}>{vi.receipt.skip}</Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 28,
    gap: 14,
  },
  handle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.border },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  headText: { flex: 1, gap: 2 },
  title: { fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: colors.text },
  sub: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.textMuted },
  row: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  label: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.textMuted },
  value: { flex: 1, alignItems: "flex-end" },
  valueText: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.text, textAlign: "right" },
  amount: { fontFamily: fontFamily.bold, fontSize: fontSize.title, color: colors.text },
  input: {
    minWidth: 160,
    textAlign: "right",
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.body,
    color: colors.text,
    paddingVertical: 6,
  },
  notice: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  noticeText: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, lineHeight: 19, color: colors.text },
  bold: { fontFamily: fontFamily.bold },
  error: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.expense },
  buttons: { flexDirection: "row", gap: 10 },
  btn: { flex: 1, height: 52, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  ghost: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  primary: { backgroundColor: colors.primary },
  ghostText: { fontFamily: fontFamily.semibold, fontSize: fontSize.row, color: colors.text },
  primaryText: { fontFamily: fontFamily.semibold, fontSize: fontSize.row, color: colors.onPrimary },
  skip: { height: 44, alignItems: "center", justifyContent: "center" },
  skipText: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.textMuted },
});
