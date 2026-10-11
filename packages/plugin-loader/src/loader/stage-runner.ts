import type { PluginDescriptor } from "@kaneo/plugin-sdk";
import {
  errorMessage,
  PluginLoadError,
  type PluginLoadStage,
} from "../load-error.js";
import { OFFICIAL_PLUGINS } from "../official/official-plugins.js";
import { guessPackageName } from "./guess-package-name.js";
import { StageError } from "./stage-error.js";
import { stageHint } from "./stage-hint.js";

export type StageContext = {
  configPath: string;
  kaneoVersion: string | null;
  official?: boolean;
};

export type StageRunner = {
  rename(label: string): void;
  run<T>(name: PluginLoadStage, step: () => T | Promise<T>): Promise<T>;
};

export function createStageRunner(
  descriptor: PluginDescriptor,
  { configPath, kaneoVersion, official = false }: StageContext,
): StageRunner {
  let label = guessPackageName(descriptor.url);
  const builtInId = () =>
    official
      ? (OFFICIAL_PLUGINS.find((plugin) => plugin.packageName === label)?.id ??
        null)
      : null;
  return {
    rename(next) {
      label = next;
    },
    async run(name, step) {
      try {
        return await step();
      } catch (error) {
        throw new PluginLoadError({
          plugin: label,
          stage: name,
          message: errorMessage(error),
          hint:
            error instanceof StageError && error.hint
              ? error.hint
              : stageHint(name, configPath, kaneoVersion, builtInId()),
          cause: error,
        });
      }
    },
  };
}
