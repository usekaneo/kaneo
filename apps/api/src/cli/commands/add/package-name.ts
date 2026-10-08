import { CliError } from "../../cli-error";

const PACKAGE_NAME = /^(?:@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/;
const WITH_VERSION = /^((?:@[^/@\s]+\/)?[^/@\s]+)@\S*$/;

export function parsePackageName(input: string): string {
  const name = input.trim();
  if (name.length <= 214 && PACKAGE_NAME.test(name)) return name;
  const versioned = WITH_VERSION.exec(name);
  if (versioned && PACKAGE_NAME.test(versioned[1] ?? "")) {
    throw new CliError(
      `kaneo add picks the version for you. Run kaneo add ${versioned[1]} without a version.`,
    );
  }
  throw new CliError(`"${input}" is not a valid npm package name.`);
}
