import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";

import { AccountQrPreview } from "@/components/bankAccounts/AccountQrPreview";
import { BankPicker } from "@/components/bankAccounts/BankPicker";
import { useRepositories } from "@/db/RepositoriesProvider";
import type { BankAccountRow } from "@/db/repositories";
import { vi } from "@/i18n/vi";
import { bankTint, formatAccountNo } from "@/lib/account/display";
import { validateAccountForm, type AccountFormErrors } from "@/lib/account/form";
import { accountQrPayload } from "@/lib/account/qrPayload";
import { findBankByBin, type Bank } from "@/lib/vietqr/banks";
import { colors, fontFamily, fontSize, layout, radii } from "@/theme";

const t = vi.bankAccounts;

export default function BankAccountsScreen() {
  const router = useRouter();
  const { bankAccounts } = useRepositories();
  const [accounts, setAccounts] = useState<BankAccountRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  // "new" = add form, id = editing, null = list/empty state
  const [mode, setMode] = useState<"new" | string | null>(null);
  const [bank, setBank] = useState<Bank | null>(null);
  const [accountNo, setAccountNo] = useState("");
  const [holder, setHolder] = useState("");
  const [makeDefault, setMakeDefault] = useState(false);
  const [errors, setErrors] = useState<AccountFormErrors>({});
  const [picking, setPicking] = useState(false);

  const reload = useCallback(async () => {
    setAccounts(await bankAccounts.listAccounts());
    setLoaded(true);
  }, [bankAccounts]);

  useEffect(() => {
    let active = true;
    (async () => {
      const rows = await bankAccounts.listAccounts();
      if (!active) return;
      setAccounts(rows);
      setLoaded(true);
    })();
    return () => {
      active = false;
    };
  }, [bankAccounts]);

  function openNew() {
    setMode("new");
    setBank(null);
    setAccountNo("");
    setHolder("");
    setMakeDefault(false);
    setErrors({});
  }

  function openEdit(a: BankAccountRow) {
    setMode(a.id);
    setBank(findBankByBin(a.bank_bin) ?? null);
    setAccountNo(a.account_no);
    setHolder(a.account_name);
    setMakeDefault(a.is_default);
    setErrors({});
  }

  async function save() {
    const found = validateAccountForm({ bank_bin: bank?.bin ?? null, account_no: accountNo });
    setErrors(found);
    if (Object.keys(found).length > 0 || !bank) return;
    const input = { bank_bin: bank.bin, account_no: accountNo, account_name: holder };
    if (mode === "new") {
      const row = await bankAccounts.addAccount(input);
      if (makeDefault) await bankAccounts.setDefault(row.id);
    } else if (mode) {
      await bankAccounts.updateAccount(mode, input);
      if (makeDefault) await bankAccounts.setDefault(mode);
    }
    setMode(null);
    await reload();
  }

  async function remove() {
    if (!mode || mode === "new") return;
    await bankAccounts.deleteAccount(mode);
    setMode(null);
    await reload();
  }

  async function promote(id: string) {
    await bankAccounts.setDefault(id);
    await reload();
  }

  const editing = mode !== null;
  const editingRow = mode && mode !== "new" ? accounts.find((a) => a.id === mode) : undefined;
  const qrPayload =
    editingRow && bank && accountNo.trim()
      ? accountQrPayload({ bank_bin: bank.bin, account_no: accountNo.replace(/\s+/g, ""), account_name: holder.trim() })
      : null;

  return (
    <View style={styles.root} testID="screen-bank-accounts">
      <View style={styles.header}>
        <Pressable
          testID="bank-accounts-back"
          accessibilityLabel="Quay lại"
          style={styles.back}
          onPress={() => (editing ? setMode(null) : router.back())}
        >
          <Text style={styles.backGlyph}>‹</Text>
        </Pressable>
        <Text style={styles.title}>{mode === "new" ? t.add : editing ? t.edit : vi.profile.rows.bankAccounts}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.caption}>{t.caption}</Text>

        {!editing && accounts.length > 0 && (
          <View style={styles.card}>
            {accounts.map((a, i) => {
              const code = findBankByBin(a.bank_bin)?.code ?? "";
              const tint = bankTint(code);
              return (
                <Pressable
                  key={a.id}
                  testID={`account-row-${a.id}`}
                  onPress={() => openEdit(a)}
                  style={[styles.accRow, i < accounts.length - 1 && styles.accRowBorder]}
                >
                  <View style={[styles.tile, { backgroundColor: tint.bg }]}>
                    <Text style={[styles.tileText, { color: tint.fg }]}>{code.slice(0, 4)}</Text>
                  </View>
                  <View style={styles.accInfo}>
                    <Text style={styles.accTitle}>
                      {a.bank_name} · {formatAccountNo(a.account_no)}
                    </Text>
                    <Text style={styles.accHolder}>{a.account_name}</Text>
                  </View>
                  {a.is_default ? (
                    <Text testID={`account-default-${a.id}`} style={styles.badge}>
                      {t.defaultBadge}
                    </Text>
                  ) : (
                    <Pressable
                      testID={`account-set-default-${a.id}`}
                      style={styles.smallBtn}
                      onPress={() => promote(a.id)}
                    >
                      <Text style={styles.smallBtnText}>{t.setDefault}</Text>
                    </Pressable>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        {!editing && loaded && accounts.length === 0 && (
          <Pressable testID="account-add" style={styles.primaryBtn} onPress={openNew}>
            <Text style={styles.primaryText}>{t.add}</Text>
          </Pressable>
        )}
        {!editing && accounts.length > 0 && (
          <Pressable testID="account-add" style={styles.outlineBtn} onPress={openNew}>
            <Text style={styles.smallBtnText}>{t.add}</Text>
          </Pressable>
        )}

        {editing && (
          <View style={styles.card}>
            <View style={styles.form}>
              <Text style={styles.sectionTitle}>{mode === "new" ? t.add : t.edit}</Text>
              <View style={styles.field}>
                <Text style={styles.label}>{t.bank}</Text>
                <Pressable testID="account-bank" style={styles.input} onPress={() => setPicking(true)}>
                  <Text style={bank ? styles.inputText : styles.placeholder}>
                    {bank?.shortName ?? t.bankPlaceholder}
                  </Text>
                  <Text style={styles.inputText}>▾</Text>
                </Pressable>
                {errors.bank_required && <Text style={styles.error}>{t.bankRequired}</Text>}
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>{t.accountNo}</Text>
                <TextInput
                  testID="account-no"
                  style={[styles.input, styles.inputText]}
                  keyboardType="number-pad"
                  placeholder={t.accountNoPlaceholder}
                  placeholderTextColor={colors.textMuted}
                  value={accountNo}
                  onChangeText={setAccountNo}
                />
                {errors.account_no_required && <Text style={styles.error}>{t.accountNoRequired}</Text>}
              </View>
              <View style={styles.field}>
                <Text style={styles.label}>{t.holder}</Text>
                <TextInput
                  testID="account-holder"
                  style={[styles.input, styles.inputText]}
                  autoCapitalize="characters"
                  value={holder}
                  onChangeText={setHolder}
                />
                <Text style={styles.hint}>{t.holderHint}</Text>
              </View>
              <Pressable
                testID="account-default-checkbox"
                accessibilityRole="checkbox"
                accessibilityState={{ checked: makeDefault }}
                style={styles.check}
                onPress={() => setMakeDefault((v) => !v)}
              >
                <View style={[styles.box, makeDefault && styles.boxOn]}>
                  {makeDefault && <Text style={styles.tick}>✓</Text>}
                </View>
                <Text style={styles.inputText}>{t.makeDefault}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {qrPayload && <AccountQrPreview payload={qrPayload} />}

        {editingRow && (
          <Pressable testID="account-delete" style={styles.outlineBtn} onPress={remove}>
            <Text style={styles.deleteText}>{t.delete}</Text>
          </Pressable>
        )}
      </ScrollView>

      {editing && (
        <View style={styles.footer}>
          <Pressable testID="account-save" style={styles.primaryBtn} onPress={save}>
            <Text style={styles.primaryText}>{t.save}</Text>
          </Pressable>
        </View>
      )}

      <BankPicker
        visible={picking}
        onClose={() => setPicking(false)}
        onSelect={(b) => {
          setBank(b);
          setPicking(false);
          setErrors((e) => ({ ...e, bank_required: undefined }));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: { height: 64, marginTop: 40, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  back: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  backGlyph: { fontSize: 30, color: colors.text },
  title: { fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: colors.text },
  body: { paddingHorizontal: layout.screenPadding, gap: 14, paddingBottom: 120 },
  caption: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.textMuted, lineHeight: 19 },
  card: { backgroundColor: colors.surface, borderRadius: radii.card, overflow: "hidden" },
  accRow: { padding: 14, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 12 },
  accRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  tile: { width: 40, height: 40, borderRadius: radii.input, alignItems: "center", justifyContent: "center" },
  tileText: { fontFamily: fontFamily.bold, fontSize: fontSize.tab },
  accInfo: { flex: 1, gap: 2 },
  accTitle: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.text },
  accHolder: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
  badge: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.tab,
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft2,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    overflow: "hidden",
  },
  smallBtn: {
    height: 32,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: "center",
  },
  smallBtnText: { fontFamily: fontFamily.semibold, fontSize: fontSize.caption, color: colors.text },
  outlineBtn: {
    height: 44,
    borderRadius: radii.button,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: { fontFamily: fontFamily.semibold, fontSize: fontSize.body, color: colors.expense },
  form: { padding: 16, paddingVertical: 14, gap: 12 },
  sectionTitle: { fontFamily: fontFamily.semibold, fontSize: fontSize.row, color: colors.text },
  field: { gap: 6 },
  label: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.textMuted },
  input: {
    height: 44,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inputText: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.text },
  placeholder: { fontFamily: fontFamily.regular, fontSize: fontSize.body, color: colors.textMuted },
  hint: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.textMuted },
  error: { fontFamily: fontFamily.regular, fontSize: fontSize.caption, color: colors.expense },
  check: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 },
  box: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  boxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: colors.onPrimary, fontSize: 13 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: layout.screenPadding,
    paddingTop: 12,
    paddingBottom: 28,
  },
  primaryBtn: {
    height: 54,
    borderRadius: radii.button,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryText: { fontFamily: fontFamily.semibold, fontSize: 16, color: colors.onPrimary },
});
