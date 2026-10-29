import { InvalidArgument } from "../errors/errors.js";
import type { VersionChoice } from "./select-version.js";

export function versionError(
  packageName: string,
  kaneoVersion: string,
  choice: Exclude<VersionChoice, { status: "ok" }>,
): InvalidArgument {
  switch (choice.status) {
    case "no-stable":
      return new InvalidArgument({
        message: `${packageName} has no stable release on npm.`,
      });
    case "all-deprecated":
      return new InvalidArgument({
        message: `Every release of ${packageName} is deprecated, including the newest, ${choice.newest}.`,
      });
    case "no-engines":
      return new InvalidArgument({
        message: `No release of ${packageName} declares engines.kaneo, so kaneo plugin add cannot tell which one supports Kaneo ${kaneoVersion}.`,
        hint: "Ask the plugin's author to add engines.kaneo to package.json. To use it anyway, install it with npm, add it to kaneo.config.ts yourself, and run kaneo plugin check.",
      });
    case "incompatible":
      return new InvalidArgument({
        message: `No release of ${packageName} supports Kaneo ${kaneoVersion}. The newest, ${choice.newest}, supports Kaneo ${choice.range}.`,
      });
  }
}
