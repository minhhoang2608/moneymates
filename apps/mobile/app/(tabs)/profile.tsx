import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { Image, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { PressableScale } from "@/components/PressableScale";

import { pickAvatar } from "@/components/AvatarPicker";
import { BankIcon, CheckIcon, GridIcon, SettingsIcon } from "@/components/icons";
import { useRepositories } from "@/db/RepositoriesProvider";
import type { BankAccountRow } from "@/db/repositories";
import { useResetOnboarding } from "@/hooks/useOnboardingStatus";
import { vi } from "@/i18n/vi";
import { initials, validateDisplayName } from "@/lib/profile/displayName";
import { colors, fontFamily, fontSize, layout, radii } from "@/theme";

type Href = "/bank-accounts" | "/categories" | "/settings";

export default function ProfileScreen() {
  const router = useRouter();
  const { profile, bankAccounts, categories } = useRepositories();
  const { mutateAsync: resetOnboarding } = useResetOnboarding();
  const [name, setName] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState(false);
  const [accounts, setAccounts] = useState<BankAccountRow[]>([]);
  const [categoryCount, setCategoryCount] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      const [p, accs, expense, income] = await Promise.all([
        profile.getProfile(),
        bankAccounts.listAccounts(),
        categories.listByKind("expense"),
        categories.listByKind("income"),
      ]);
      if (!active) return;
      setName(p.display_name);
      setAvatarUri(p.avatar_uri);
      setAccounts(accs);
      setCategoryCount(expense.length + income.length);
    })();
    return () => {
      active = false;
    };
  }, [profile, bankAccounts, categories]);

  const save = useCallback(async () => {
    const result = validateDisplayName(draft);
    if (!result.ok) {
      setError(true);
      return;
    }
    const saved = await profile.setDisplayName(result.name);
    setName(saved.display_name);
    setError(false);
    setEditing(false);
  }, [draft, profile]);

  const changeAvatar = useCallback(async () => {
    const uri = await pickAvatar();
    if (!uri) return;
    const saved = await profile.setAvatar(uri);
    setAvatarUri(saved.avatar_uri);
  }, [profile]);

  const defaultAccount = accounts.find((a) => a.is_default);

  const rerunOnboarding = useCallback(async () => {
    await resetOnboarding();
    router.push("/onboarding");
  }, [resetOnboarding, router]);

  const rows: { id: string; href?: Href; label: string; icon: React.ReactNode; count?: number }[] = [
    {
      id: "row-bank-accounts",
      href: "/bank-accounts",
      label: vi.profile.rows.bankAccounts,
      icon: <BankIcon color={colors.primary} size={22} />,
      count: accounts.length,
    },
    {
      id: "row-categories",
      href: "/categories",
      label: vi.profile.rows.categories,
      icon: <GridIcon color={colors.primary} size={22} />,
      count: categoryCount,
    },
    {
      id: "row-settings",
      href: "/settings",
      label: vi.profile.rows.settings,
      icon: <SettingsIcon color={colors.primary} size={22} />,
    },
    {
      id: "row-onboarding",
      label: vi.profile.rows.onboarding,
      icon: <CheckIcon color={colors.primary} size={22} />,
    },
  ];

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content} testID="screen-profile">
      <Text style={styles.title}>{vi.profile.title}</Text>

      <View style={styles.card}>
        <PressableScale
          testID="profile-avatar"
          accessibilityRole="button"
          accessibilityLabel={vi.profile.avatarA11y}
          onPress={changeAvatar}
          style={styles.avatar}
        >
          {avatarUri ? (
            <Image testID="profile-avatar-image" source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{initials(name)}</Text>
          )}
        </PressableScale>
        <View style={styles.nameBlock}>
          {editing ? (
            <TextInput
              testID="profile-name-input"
              value={draft}
              onChangeText={setDraft}
              placeholder={vi.profile.namePlaceholder}
              style={styles.input}
              autoFocus
            />
          ) : (
            <Text testID="profile-name" style={styles.name}>
              {name}
            </Text>
          )}
          <Text style={styles.subtitle}>{vi.profile.subtitle}</Text>
        </View>
        {editing ? (
          <PressableScale testID="profile-name-save" onPress={save} style={styles.smallButton}>
            <Text style={styles.smallButtonText}>{vi.profile.save}</Text>
          </PressableScale>
        ) : (
          <PressableScale
            testID="profile-edit-name"
            onPress={() => {
              setDraft(name);
              setError(false);
              setEditing(true);
            }}
            style={styles.smallButton}
          >
            <Text style={styles.smallButtonText}>{vi.profile.edit}</Text>
          </PressableScale>
        )}
      </View>
      {error ? (
        <Text testID="profile-name-error" style={styles.error}>
          {vi.profile.nameRequired}
        </Text>
      ) : null}

      {defaultAccount ? (
        <View style={styles.accountCard} testID="profile-default-account">
          <View style={styles.accountHeader}>
            <Text style={styles.accountLabel}>{vi.profile.defaultAccount}</Text>
            <Text style={styles.badge}>{vi.profile.defaultBadge}</Text>
          </View>
          <Text style={styles.accountNo}>{defaultAccount.account_no}</Text>
          <Text style={styles.accountMeta}>
            {defaultAccount.account_name} · {defaultAccount.bank_name}
          </Text>
        </View>
      ) : null}

      <View style={styles.list}>
        {rows.map((row, i) => (
          <PressableScale
            key={row.id}
            testID={row.id}
            accessibilityRole="button"
            onPress={() => (row.href ? router.push(row.href) : void rerunOnboarding())}
            style={[styles.row, i < rows.length - 1 && styles.rowBorder]}
          >
            {row.icon}
            <Text style={styles.rowLabel}>{row.label}</Text>
            {row.count !== undefined ? <Text style={styles.rowCount}>{row.count}</Text> : null}
            <Text style={styles.chevron}>›</Text>
          </PressableScale>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { padding: layout.screenPadding, gap: 16, paddingBottom: layout.tabBarHeight + 24 },
  title: { fontFamily: fontFamily.bold, fontSize: fontSize.heading, color: colors.text },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.profileCard,
    paddingVertical: 18,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImage: { width: 64, height: 64 },
  avatarText: { fontFamily: fontFamily.bold, fontSize: fontSize.heading, color: colors.onPrimary },
  nameBlock: { flex: 1, gap: 2 },
  name: { fontFamily: fontFamily.semibold, fontSize: fontSize.title, color: colors.text },
  input: {
    height: 36,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: 8,
    fontFamily: fontFamily.regular,
    fontSize: fontSize.row,
    color: colors.text,
  },
  subtitle: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.textMuted },
  smallButton: {
    height: 36,
    paddingHorizontal: 12,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  smallButtonText: { fontFamily: fontFamily.semibold, fontSize: fontSize.secondary, color: colors.text },
  error: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.expense },
  accountCard: {
    backgroundColor: colors.primary,
    borderRadius: radii.profileCard,
    padding: 16,
    gap: 10,
  },
  accountHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  accountLabel: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.secondary,
    color: colors.onPrimary,
    opacity: 0.85,
  },
  badge: {
    fontFamily: fontFamily.semibold,
    fontSize: fontSize.tab,
    color: colors.onPrimary,
    backgroundColor: colors.primaryDark,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 6,
    overflow: "hidden",
  },
  accountNo: {
    fontFamily: fontFamily.bold,
    fontSize: 18,
    letterSpacing: 0.5,
    color: colors.onPrimary,
  },
  accountMeta: {
    fontFamily: fontFamily.regular,
    fontSize: fontSize.secondary,
    color: colors.onPrimary,
    opacity: 0.9,
  },
  list: { backgroundColor: colors.surface, borderRadius: radii.card, overflow: "hidden" },
  row: {
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.divider },
  rowLabel: { flex: 1, fontFamily: fontFamily.regular, fontSize: fontSize.row, color: colors.text },
  rowCount: { fontFamily: fontFamily.regular, fontSize: fontSize.secondary, color: colors.textMuted },
  chevron: { color: colors.neutral },
});
