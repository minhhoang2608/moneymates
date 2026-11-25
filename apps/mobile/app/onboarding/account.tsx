import { useEffect, useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { BankPicker } from "@/components/bankAccounts/BankPicker";
import { OnboardingStep, onboardingTextStyles } from "@/components/onboarding/OnboardingStep";
import { PressableScale } from "@/components/PressableScale";
import { useRepositories } from "@/db/RepositoriesProvider";
import { useFinishOnboarding } from "@/hooks/useFinishOnboarding";
import { vi } from "@/i18n/vi";
import {
  isAccountNoNumeric,
  normalizeHolderName,
  validateAccountForm,
  type AccountFormErrors,
} from "@/lib/account/form";
import { findBankByBin, type Bank } from "@/lib/vietqr/banks";
import { colors, fontFamily, fontSize, radii } from "@/theme";

const t = vi.onboarding.account;

/** Onboarding step 4/4: receiving bank account, then finish. */
export default function OnboardingAccountScreen() {
  const finish = useFinishOnboarding();
  const { bankAccounts } = useRepositories();
  const [bank, setBank] = useState<Bank | null>(null);
  const [accountNo, setAccountNo] = useState("");
  const [holder, setHolder] = useState("");
  const [existingId, setExistingId] = useState<string | null>(null);
  const [errors, setErrors] = useState<AccountFormErrors>({});
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const row = await bankAccounts.getDefaultAccount();
      if (!active || !row) return;
      setExistingId(row.id);
      setBank(findBankByBin(row.bank_bin) ?? null);
      setAccountNo(row.account_no);
      setHolder(row.account_name);
    })();
    return () => {
      active = false;
    };
  }, [bankAccounts]);

  const valid = !!bank && isAccountNoNumeric(accountNo) && normalizeHolderName(holder).length > 0;

  async function save() {
    if (busy) return;
    const found = validateAccountForm({ bank_bin: bank?.bin ?? null, account_no: accountNo });
    setErrors(found);
    if (!valid || !bank) return;
    setBusy(true);
    try {
      const input = {
        bank_bin: bank.bin,
        account_no: accountNo.replace(/\s+/g, ""),
        account_name: normalizeHolderName(holder),
      };
      if (existingId) {
        await bankAccounts.updateAccount(existingId, input);
      } else {
        const row = await bankAccounts.addAccount(input);
        await bankAccounts.setDefault(row.id);
      }
      await finish();
    } finally {
      setBusy(false);
    }
  }

  return (
    <OnboardingStep
      step={4}
      onNext={() => void save()}
      onSkip={() => void finish()}
      nextLabel={t.finish}
      nextDisabled={!valid}
      testID="onboarding-account"
    >
      <Text style={onboardingTextStyles.title}>{t.title}</Text>
      <Text style={onboardingTextStyles.subtitle}>{t.subtitle}</Text>
      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>{t.bank}</Text>
          <PressableScale testID="onb-account-bank" style={styles.input} onPress={() => setPicking(true)}>
            <Text style={bank ? styles.inputText : styles.placeholder}>{bank?.shortName ?? t.bankPlaceholder}</Text>
            <Text style={styles.chevron}>›</Text>
          </PressableScale>
          {errors.bank_required && (
            <Text testID="onb-account-bank-error" style={styles.error}>
              {vi.bankAccounts.bankRequired}
            </Text>
          )}
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>{t.accountNo}</Text>
          <TextInput
            testID="onb-account-no"
            style={[styles.input, styles.inputText]}
            keyboardType="number-pad"
            value={accountNo}
            onChangeText={setAccountNo}
          />
          {errors.account_no_required && (
            <Text testID="onb-account-no-error" style={styles.error}>
              {vi.bankAccounts.accountNoRequired}
            </Text>
          )}
        </View>
        <View style={styles.field}>
          <Text style={styles.label}>{t.holder}</Text>
          <TextInput
            testID="onb-account-holder"
            style={[styles.input, styles.inputText]}
            autoCapitalize="characters"
            value={holder}
            onChangeText={setHolder}
            onBlur={() => setHolder((h) => normalizeHolderName(h))}
          />
          <Text style={styles.hint}>{t.holderHint}</Text>
        </View>
        <View style={styles.info}>
          <Text style={styles.infoText}>{t.info}</Text>
        </View>
      </View>
      <BankPicker
        visible={picking}
        onClose={() => setPicking(false)}
        onSelect={(b) => {
          setBank(b);
          setPicking(false);
          setErrors((e) => ({ ...e, bank_required: undefined }));
        }}
      />
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  form: { paddingTop: 14, gap: 16 },
  field: { gap: 8 },
  label: { fontFamily: fontFamily.semibold, fontSize: 13, color: colors.textMuted },
  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  inputText: { fontFamily: fontFamily.regular, fontSize: 15, color: colors.text },
  placeholder: { fontFamily: fontFamily.regular, fontSize: 15, color: colors.textMuted },
  chevron: { fontSize: 18, color: colors.textMuted },
  hint: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted },
  error: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.expense },
  info: { backgroundColor: colors.primarySoft2, borderRadius: radii.card, padding: 14 },
  infoText: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, lineHeight: 19, color: colors.primaryDark },
});
