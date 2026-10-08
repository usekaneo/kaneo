import type { PluginDescriptor } from "@kaneo/plugin-sdk";
import {
  errorMessage,
  PluginLoadError,
  type PluginLoadStage,
} from "../load-error";
import { guessPackageName } from "./guess-package-name";
import { StageError } from "./stage-error";
import { stageHint } from "./stage-hint";

export type StageContext = {
  configPath: string;
  kaneoVersion: string | null;
};

export type StageRunner = {
  rename(label: string): void;
  run<T>(name: PluginLoadStage, step: () => T | Promise<T>): Promise<T>;
};

export function createStageRunner(
  descriptor: PluginDescriptor,
  { configPath, kaneoVersion }: StageContext,
): StageRunner {
  let label = guessPackageName(descriptor.url);
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
              : stageHint(name, configPath, kaneoVersion),
          cause: error,
        });
      }
    },
  };
}
