import { Effect } from "effect";
import { InvalidArgument } from "../errors/errors.js";
import { withSpinner } from "../output/spinner.js";
import { Npm } from "../services/npm.js";
import { selectVersion } from "./select-version.js";
import { versionError } from "./version-error.js";

export const pickRelease = Effect.fnUntraced(function* (options: {
  readonly projectDir: string;
  readonly packageName: string;
  readonly kaneoVersion: string;
}) {
  const npm = yield* Npm;
  const releases = yield* withSpinner(
    `Looking up ${options.packageName} with npm`,
  )(npm.releases(options.projectDir, options.packageName));
  if (!releases.ok) {
    return yield* new InvalidArgument({
      message: `npm could not look up ${options.packageName}: ${releases.message}`,
    });
  }
  const choice = selectVersion(releases.releases, options.kaneoVersion);
  if (choice.status !== "ok") {
    return yield* versionError(
      options.packageName,
      options.kaneoVersion,
      choice,
    );
  }
  return { version: choice.version, range: choice.range };
});
