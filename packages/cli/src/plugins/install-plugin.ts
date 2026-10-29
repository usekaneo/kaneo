import { errorMessage } from "@kaneo/plugin-loader";
import { Effect } from "effect";
import { InvalidArgument } from "../errors/errors.js";
import { Npm } from "../services/npm.js";
import { humanNote } from "./human-note.js";
import { ensureProjectPackage } from "./project-package.js";

export const installPlugin = Effect.fnUntraced(function* (options: {
  readonly projectDir: string;
  readonly packageName: string;
  readonly version: string;
  readonly kaneoVersion: string;
}) {
  const npm = yield* Npm;
  const project = yield* Effect.tryPromise({
    try: () => ensureProjectPackage(options.projectDir),
    catch: (error) => new InvalidArgument({ message: errorMessage(error) }),
  });
  const specs = [`${options.packageName}@${options.version}`];
  if (!project.hasConfigPackage) {
    specs.push(`@kaneo/config@${options.kaneoVersion}`);
  }

  yield* humanNote((ui) => [
    ...(project.created
      ? [
          `  ${ui.theme.muted(`Created package.json in ${options.projectDir}.`)}`,
        ]
      : []),
    `  ${ui.theme.muted(`Running npm install --save-exact ${specs.join(" ")}`)}`,
  ]);
  const result = yield* npm.install(options.projectDir, specs);
  if (!result.ok) {
    return yield* new InvalidArgument({
      message: result.message
        ? `npm install failed: ${result.message}`
        : "npm install failed, see its output above.",
      hint: "The config file was not changed. Fix the problem and run the command again.",
    });
  }
  return { specs, createdPackageJson: project.created };
});
