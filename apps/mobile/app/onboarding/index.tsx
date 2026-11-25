import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, TextInput, View } from "react-native";

import { pickAvatar } from "@/components/AvatarPicker";
import { PressableScale } from "@/components/PressableScale";
import { CameraIcon } from "@/components/icons";
import { OnboardingStep, onboardingTextStyles } from "@/components/onboarding/OnboardingStep";
import { useRepositories } from "@/db/RepositoriesProvider";
import { useFinishOnboarding } from "@/hooks/useFinishOnboarding";
import { vi } from "@/i18n/vi";
import { initials, validateDisplayName } from "@/lib/profile/displayName";
import { colors, fontFamily, radii } from "@/theme";

/** Onboarding step 1/4: display name and optional avatar. */
export default function OnboardingProfileScreen() {
  const router = useRouter();
  const { profile } = useRepositories();
  const finish = useFinishOnboarding();
  const t = vi.onboarding.profile;
  const [name, setName] = useState("");
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [pickedNew, setPickedNew] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    void profile.getProfile().then((p) => {
      if (!alive) return;
      setName(p.display_name);
      setAvatarUri(p.avatar_uri);
    });
    return () => {
      alive = false;
    };
  }, [profile]);

  const changeAvatar = async () => {
    const uri = await pickAvatar();
    if (!uri) return;
    setAvatarUri(uri);
    setPickedNew(true);
  };

  const onNext = async () => {
    const result = validateDisplayName(name);
    if (!result.ok) {
      setError(true);
      return;
    }
    await profile.setDisplayName(result.name);
    if (pickedNew && avatarUri) await profile.setAvatar(avatarUri);
    router.push("/onboarding/apps");
  };

  return (
    <OnboardingStep step={1} onNext={() => void onNext()} onSkip={() => void finish()} testID="onboarding-profile">
      <Text style={onboardingTextStyles.title}>{t.title}</Text>
      <Text style={onboardingTextStyles.subtitle}>{t.subtitle}</Text>
      <View style={styles.body}>
        <PressableScale
          testID="onb-avatar"
          accessibilityRole="button"
          accessibilityLabel={t.avatarA11y}
          onPress={() => void changeAvatar()}
          style={styles.avatar}
        >
          {avatarUri ? (
            <Image testID="onb-avatar-image" source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <Text style={styles.avatarText}>{initials(name)}</Text>
          )}
          <View style={styles.badge}>
            <CameraIcon color={colors.onPrimary} size={16} />
          </View>
        </PressableScale>
        <View style={styles.field}>
          <Text style={styles.label}>{t.nameLabel}</Text>
          <TextInput
            testID="onb-name-input"
            value={name}
            onChangeText={(v) => {
              setName(v);
              setError(false);
            }}
            style={styles.input}
          />
          {error ? (
            <Text testID="onb-name-error" style={styles.error}>
              {vi.profile.nameRequired}
            </Text>
          ) : null}
          <Text style={styles.hint}>{t.hint}</Text>
        </View>
      </View>
    </OnboardingStep>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: 26, alignItems: "center", gap: 28 },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: { width: 112, height: 112, borderRadius: 56 },
  avatarText: { fontFamily: fontFamily.bold, fontSize: 40, color: colors.primary },
  badge: {
    position: "absolute",
    right: 0,
    bottom: 4,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    borderWidth: 3,
    borderColor: colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  field: { width: "100%", gap: 8 },
  label: { fontFamily: fontFamily.semibold, fontSize: 13, color: colors.textMuted },
  input: {
    height: 52,
    borderRadius: radii.input,
    borderWidth: 1.5,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    fontFamily: fontFamily.regular,
    fontSize: 16,
    color: colors.text,
  },
  hint: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.textMuted },
  error: { fontFamily: fontFamily.regular, fontSize: 12, color: colors.expense },
});
