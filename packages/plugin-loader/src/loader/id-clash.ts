import { StageError } from "./stage-error.js";

export type PluginIdentity = {
  id: string;
  packageName: string;
  official: boolean;
};

export function idClashError(
  existing: PluginIdentity,
  packageName: string,
  configPath: string,
): StageError {
  return new StageError(
    `Plugin id "${existing.id}" is already used by "${existing.packageName}".`,
    existing.official
      ? `Turn off the built-in plugin with official: { ${existing.id}: false } in ${configPath}, or remove "${packageName}" from it.`
      : `Remove one of them from ${configPath}.`,
  );
}
