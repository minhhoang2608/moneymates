const { withAndroidManifest } = require("expo/config-plugins");

const SERVICE_NAME = "com.moneymates.notificationlistener.BankNotificationListenerService";

/** Pure manifest edit (idempotent). Adds the notification listener service; no uses-permission. */
function addNotificationListenerService(manifest) {
  const app = manifest.manifest.application[0];
  app.service = app.service ?? [];
  if (app.service.some((s) => s.$["android:name"] === SERVICE_NAME)) return manifest;
  app.service.push({
    $: {
      "android:name": SERVICE_NAME,
      "android:exported": "true",
      "android:permission": "android.permission.BIND_NOTIFICATION_LISTENER_SERVICE",
    },
    "intent-filter": [
      { action: [{ $: { "android:name": "android.service.notification.NotificationListenerService" } }] },
    ],
  });
  return manifest;
}

module.exports = function withNotificationListener(config) {
  return withAndroidManifest(config, (cfg) => {
    addNotificationListenerService(cfg.modResults);
    return cfg;
  });
};
module.exports.addNotificationListenerService = addNotificationListenerService;
