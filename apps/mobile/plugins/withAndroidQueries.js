const { withAndroidManifest } = require("expo/config-plugins");

/** Adds <queries><intent> entries so Linking.canOpenURL can see which bank/wallet apps are installed (Android 11+). */
module.exports = function withAndroidQueries(config, { schemes = [] } = {}) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.queries = manifest.queries ?? [{}];
    const queries = manifest.queries[0];
    queries.intent = queries.intent ?? [];
    for (const scheme of schemes) {
      const exists = queries.intent.some((i) => i.data?.some((d) => d.$["android:scheme"] === scheme));
      if (exists) continue;
      queries.intent.push({
        action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
        category: [{ $: { "android:name": "android.intent.category.BROWSABLE" } }],
        data: [{ $: { "android:scheme": scheme } }],
      });
    }
    return cfg;
  });
};
