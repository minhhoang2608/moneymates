// eslint-disable-next-line @typescript-eslint/no-require-imports
const { addNotificationListenerService } = require("../withNotificationListener");
import appJson from "../../app.json";

const bare = (): any => ({ manifest: { application: [{ $: {} }] } });

describe("withNotificationListener", () => {
  it("adds one service with permission, exported and intent-filter", () => {
    const m = addNotificationListenerService(bare());
    const services = m.manifest.application[0].service;
    expect(services).toHaveLength(1);
    expect(services[0].$).toEqual({
      "android:name": "com.moneymates.notificationlistener.BankNotificationListenerService",
      "android:exported": "true",
      "android:permission": "android.permission.BIND_NOTIFICATION_LISTENER_SERVICE",
    });
    expect(services[0]["intent-filter"][0].action[0].$["android:name"]).toBe(
      "android.service.notification.NotificationListenerService",
    );
  });
  it("is idempotent", () => {
    const m = addNotificationListenerService(addNotificationListenerService(bare()));
    expect(m.manifest.application[0].service).toHaveLength(1);
  });
  it("adds no uses-permission", () => {
    expect(addNotificationListenerService(bare()).manifest["uses-permission"]).toBeUndefined();
  });
  it("is registered in app.json without SMS permissions", () => {
    expect(appJson.expo.plugins).toContain("./plugins/withNotificationListener");
    const perms = appJson.expo.android.permissions.join(" ");
    expect(perms).not.toMatch(/READ_SMS|RECEIVE_SMS/);
  });
});
