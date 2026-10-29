import type { PluginCheck, PluginLoadStage } from "@kaneo/plugin-loader";
import type { KaneoVersionSource } from "./kaneo-target.js";

export type PluginCheckEntry =
  | {
      readonly status: "ok";
      readonly id: string;
      readonly packageName: string;
      readonly version: string;
      readonly official: boolean;
    }
  | {
      readonly status: "failed";
      readonly packageName: string | null;
      readonly official: boolean;
      readonly stage: PluginLoadStage;
      readonly message: string;
      readonly hint: string;
    };

export type PluginCheckReport = {
  readonly projectDir: string;
  readonly configPath: string | null;
  readonly declared: number;
  readonly kaneoVersion: string;
  readonly kaneoVersionSource: KaneoVersionSource;
  readonly skippedBuiltIn: ReadonlyArray<string>;
  readonly warnings: ReadonlyArray<string>;
  readonly plugins: ReadonlyArray<PluginCheckEntry>;
  readonly failed: number;
};

export function toCheckEntry(result: PluginCheck): PluginCheckEntry {
  if (result.ok) {
    return {
      status: "ok",
      id: result.id,
      packageName: result.packageName,
      version: result.version,
      official: result.official,
    };
  }
  return {
    status: "failed",
    packageName: result.error.plugin,
    official: result.official,
    stage: result.error.stage,
    message: result.error.message,
    hint: result.error.hint,
  };
}
