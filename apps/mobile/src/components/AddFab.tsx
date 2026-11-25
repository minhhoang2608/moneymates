import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Keyboard, Platform, StyleSheet } from "react-native";

import { EntryMenu } from "@/components/EntryMenu";
import { PlusIcon } from "@/components/icons";
import { PressableScale } from "@/components/PressableScale";
import { vi } from "@/i18n/vi";
import { colors } from "@/theme";

const SIZE = 52;
const MARGIN = 20;
/** Bottom padding a tab's scroll content needs so its last row clears the button. */
export const FAB_CLEARANCE = SIZE + MARGIN + 24;

export function AddFab({ testID }: { testID: string }) {
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  // Android pushes the button above the keyboard, so hide it while typing.
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const show = Keyboard.addListener("keyboardDidShow", () => setKeyboardOpen(true));
    const hide = Keyboard.addListener("keyboardDidHide", () => setKeyboardOpen(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return (
    <>
      {keyboardOpen ? null : (
        <PressableScale
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={vi.overview.add}
          onPress={() => setMenuOpen(true)}
          style={styles.fab}
        >
          <PlusIcon color={colors.primary} size={24} />
        </PressableScale>
      )}
      <EntryMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        onManual={() => {
          setMenuOpen(false);
          router.push("/transaction/new");
        }}
        onVoice={() => {
          setMenuOpen(false);
          router.push("/voice");
        }}
        onBill={() => {
          setMenuOpen(false);
          router.push("/bill");
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: MARGIN,
    bottom: MARGIN,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.text,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
});
