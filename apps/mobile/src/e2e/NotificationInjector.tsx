import { Text, View } from "react-native";

import notifications from "../../e2e/fixtures/notifications.json";
import { PressableScale } from "@/components/PressableScale";
import { useRepositories } from "@/db/RepositoriesProvider";
import { useAutoDetect } from "@/stores/autoDetect";

import { emitE2eNotification, setE2eAccessGranted } from "./notificationListener";

/** E2E only: buttons that grant mock notification access and emit a fixture bank notification. */
export function E2eNotificationInjector() {
  const { preferences } = useRepositories();
  const matched = useAutoDetect((s) => s.lastMatchedHandOffId);

  const enable = async () => {
    setE2eAccessGranted(true);
    await preferences.setAutoDetectTransfers(true);
    useAutoDetect.getState().bump();
  };
  const inject = () => emitE2eNotification({ ...notifications.tpbankDebit, postedAt: Date.now() });

  return (
    <View style={{ position: "absolute", bottom: 0, left: 0, flexDirection: "row", gap: 4 }} pointerEvents="box-none">
      <PressableScale testID="e2e-notif-enable" onPress={() => void enable()}>
        <Text>notif-on</Text>
      </PressableScale>
      <PressableScale testID="e2e-notif-inject-tpbank" onPress={inject}>
        <Text>notif-tpbank</Text>
      </PressableScale>
      <Text testID="e2e-notif-status">{matched ? "paid:notification" : "idle"}</Text>
    </View>
  );
}
