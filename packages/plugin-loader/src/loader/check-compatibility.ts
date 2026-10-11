import type { PluginPackage } from "@kaneo/plugin-sdk";
import semver from "semver";

export type CompatibilityResult =
  | { status: "ok" }
  | { status: "warn"; message: string }
  | { status: "fail"; message: string };

export function checkCompatibility(
  plugin: Pick<PluginPackage, "packageName" | "version" | "engines">,
  kaneoVersion: string | null,
): CompatibilityResult {
  if (!plugin.engines) {
    return {
      status: "warn",
      message: `Plugin "${plugin.packageName}" ${plugin.version} does not declare engines.kaneo, so Kaneo cannot check that it supports this version.`,
    };
  }
  if (!semver.validRange(plugin.engines)) {
    return {
      status: "fail",
      message: `${plugin.version} declares engines.kaneo "${plugin.engines}", which is not a valid semver range.`,
    };
  }
  if (!kaneoVersion || !semver.valid(kaneoVersion)) {
    return {
      status: "warn",
      message: `Kaneo could not determine its own version, so plugin "${plugin.packageName}" was not checked against ${plugin.engines}. Set KANEO_VERSION to enable the check.`,
    };
  }
  if (
    !semver.satisfies(kaneoVersion, plugin.engines, {
      includePrerelease: true,
    })
  ) {
    return {
      status: "fail",
      message: `${plugin.version} supports Kaneo ${plugin.engines}, this is Kaneo ${kaneoVersion}.`,
    };
  }
  return { status: "ok" };
}
