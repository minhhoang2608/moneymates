import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import notifications from "../../e2e/fixtures/notifications.json";
import { PressableScale } from "@/components/PressableScale";
import { useRepositories } from "@/db/RepositoriesProvider";
import { useAutoDetect } from "@/stores/autoDetect";

import { emitE2eNotification, setE2eAccessGranted } from "./notificationListener";

/** E2E only: buttons that grant mock notification access and emit a fixture bank notification. */
export function E2eNotificationInjector() {
  const { preferences } = useRepositories();
  const insets = useSafeAreaInsets();
  const matched = useAutoDetect((s) => s.lastMatchedHandOffId);

  const enable = async () => {
    setE2eAccessGranted(true);
    await preferences.setAutoDetectTransfers(true);
    useAutoDetect.getState().bump();
  };
  const inject = () => emitE2eNotification({ ...notifications.tpbankDebit, postedAt: Date.now() });

  return (
    <View
      testID="e2e-notif-overlay"
      style={{
        position: "absolute",
        top: insets.top + 4,
        left: 0,
        right: 0,
        flexDirection: "row",
        justifyContent: "center",
        alignItems: "center",
        gap: 4,
        zIndex: 1000,
        elevation: 1000,
      }}
      pointerEvents="box-none"
    >
      <PressableScale testID="e2e-notif-enable" style={{ minHeight: 32, minWidth: 32 }} onPress={() => void enable()}>
        <Text>notif-on</Text>
      </PressableScale>
      <PressableScale testID="e2e-notif-inject-tpbank" style={{ minHeight: 32, minWidth: 32 }} onPress={inject}>
        <Text>notif-tpbank</Text>
      </PressableScale>
      <Text testID="e2e-notif-status">{matched ? "paid:notification" : "idle"}</Text>
    </View>
  );
}
