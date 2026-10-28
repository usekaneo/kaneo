const { withGradleProperties } = require("expo/config-plugins");

/**
 * Release builds run out of heap while merging dex files with the template's 2 GB default, so give
 * the Gradle daemon more room. Lives here so `expo prebuild` keeps it.
 */
module.exports = function withGradleMemory(
  config,
  { heap = "6g", metaspace = "1g" } = {},
) {
  return withGradleProperties(config, (cfg) => {
    const value = `-Xmx${heap} -XX:MaxMetaspaceSize=${metaspace} -Dfile.encoding=UTF-8`;
    const entry = cfg.modResults.find(
      (item) => item.type === "property" && item.key === "org.gradle.jvmargs",
    );
    if (entry) entry.value = value;
    else
      cfg.modResults.push({
        type: "property",
        key: "org.gradle.jvmargs",
        value,
      });
    return cfg;
  });
};
