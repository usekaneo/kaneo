const { withAppBuildGradle } = require("expo/config-plugins");

const RELEASE_CONFIG = `
        release {
            def keystore = System.getenv("KANEO_ANDROID_KEYSTORE")
            if (keystore) {
                storeFile file(keystore)
                storePassword System.getenv("KANEO_ANDROID_KEYSTORE_PASSWORD")
                keyAlias System.getenv("KANEO_ANDROID_KEY_ALIAS")
                keyPassword System.getenv("KANEO_ANDROID_KEY_PASSWORD")
            }
        }`;

/**
 * Signs release builds with the keystore named by `KANEO_ANDROID_KEYSTORE` (plus its passwords and
 * alias), and falls back to the debug key when it is unset so local release builds keep working.
 * APKs must keep one key for updates to install over each other, so CI sets these from secrets.
 */
function addReleaseSigning(gradle) {
  if (gradle.includes("KANEO_ANDROID_KEYSTORE")) return gradle;
  const withConfig = gradle.replace(
    /(signingConfigs \{\n\s*debug \{[^}]*\})/,
    `$1${RELEASE_CONFIG}`,
  );
  const result = withConfig.replace(
    /(release \{\n(?:\s*\/\/[^\n]*\n)*\s*)signingConfig signingConfigs\.debug/,
    `$1signingConfig System.getenv("KANEO_ANDROID_KEYSTORE") ? signingConfigs.release : signingConfigs.debug`,
  );
  // Fail the prebuild rather than quietly ship debug-signed builds if the template changes.
  if (withConfig === gradle || result === withConfig)
    throw new Error(
      "with-release-signing: app/build.gradle no longer matches; update the plugin",
    );
  return result;
}

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = addReleaseSigning(cfg.modResults.contents);
    return cfg;
  });
};

module.exports.addReleaseSigning = addReleaseSigning;
