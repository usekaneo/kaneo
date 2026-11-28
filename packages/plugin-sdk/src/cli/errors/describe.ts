import type { BuildError } from "./errors.js";

export type Failure = {
  readonly message: string;
  readonly hint: string | null;
};

const MISSING_VITE =
  "kaneo-plugin build needs Vite 7 or newer. Add it to the plugin: npm install --save-dev vite";

export function describeError(error: BuildError): Failure {
  switch (error._tag) {
    case "PackageJsonMissing":
      return {
        message: `No package.json in ${error.root}. Run kaneo-plugin build from the plugin's root folder.`,
        hint: null,
      };
    case "PackageJsonInvalid":
      return { message: error.message, hint: null };
    case "EntryMissing":
      return {
        message:
          "src/index.ts is missing. It must default-export definePlugin(import.meta.url, { ... }).",
        hint: null,
      };
    case "ViteMissing":
      return { message: MISSING_VITE, hint: null };
    case "ViteUnloadable":
      return { message: `Could not load Vite: ${error.detail}`, hint: null };
    case "ViteTooOld":
      return {
        message: `kaneo-plugin build needs Vite 7 or newer, found ${error.version}`,
        hint: null,
      };
    case "TypesFailed":
      return { message: error.message, hint: null };
    case "InvalidOutput":
      return {
        message: `The build output is not a valid Kaneo plugin:\n${error.problems.map((problem) => `  - ${problem}`).join("\n")}`,
        hint: null,
      };
    case "BuildFailed":
      return { message: error.message, hint: null };
    default:
      return error satisfies never;
  }
}
