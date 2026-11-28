export type PluginLoadStage =
  | "config"
  | "resolve"
  | "entry"
  | "compatibility"
  | "options"
  | "import"
  | "start";

export class PluginLoadError extends Error {
  readonly plugin: string | null;
  readonly stage: PluginLoadStage;
  readonly hint: string;

  constructor(options: {
    plugin: string | null;
    stage: PluginLoadStage;
    message: string;
    hint: string;
    cause?: unknown;
  }) {
    super(options.message, { cause: options.cause });
    this.name = "PluginLoadError";
    this.plugin = options.plugin;
    this.stage = options.stage;
    this.hint = options.hint;
  }

  format(): string {
    const heading = this.plugin
      ? `Plugin "${this.plugin}" failed at ${this.stage}:`
      : "Kaneo could not load its plugin config:";
    return [heading, this.message, this.hint].filter(Boolean).join("\n");
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
