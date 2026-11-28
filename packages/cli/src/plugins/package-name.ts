import { Result } from "effect";
import { InvalidArgument } from "../errors/errors.js";

const PACKAGE_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
const WITH_VERSION = /^((?:@[^/@\s]+\/)?[^/@\s]+)@\S*$/;

export function parsePackageName(
  input: string,
): Result.Result<string, InvalidArgument> {
  const name = input.trim();
  if (name.length <= 214 && PACKAGE_NAME.test(name)) {
    return Result.succeed(name);
  }
  const versioned = WITH_VERSION.exec(name);
  if (versioned && PACKAGE_NAME.test(versioned[1] ?? "")) {
    return Result.fail(
      new InvalidArgument({
        message: `kaneo plugin add picks the version for you. Run kaneo plugin add ${versioned[1]} without a version.`,
      }),
    );
  }
  return Result.fail(
    new InvalidArgument({
      message: `"${input}" is not a valid npm package name.`,
      hint: "Pass the package name as it appears on npm, for example kaneo-plugin-task-progress.",
    }),
  );
}
