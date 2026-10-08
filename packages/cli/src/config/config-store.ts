import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { Context, Effect, Layer } from "effect";
import { ConfigUnreadable } from "../errors/errors.js";
import { CliEnvironment } from "../services/cli-environment.js";
import { configPath } from "./config-path.js";
import {
  type ConfigFile,
  emptyConfig,
  parseConfig,
  serializeConfig,
} from "./format.js";

export type ConfigStoreShape = {
  readonly path: string;
  readonly load: Effect.Effect<ConfigFile, ConfigUnreadable>;
  readonly save: (config: ConfigFile) => Effect.Effect<void, ConfigUnreadable>;
};

export class ConfigStore extends Context.Service<
  ConfigStore,
  ConfigStoreShape
>()("kaneo/ConfigStore") {}

function isMissing(cause: unknown): boolean {
  return (cause as { code?: unknown } | null)?.code === "ENOENT";
}

function ioError(path: string, cause: unknown): ConfigUnreadable {
  return new ConfigUnreadable({
    path,
    reason: "io",
    detail: cause instanceof Error ? cause.message : String(cause),
  });
}

export function makeConfigStore(path: string): ConfigStoreShape {
  const load = Effect.tryPromise({
    try: () => readFile(path, "utf8"),
    catch: (cause) => cause,
  }).pipe(
    Effect.matchEffect({
      onFailure: (cause) =>
        isMissing(cause)
          ? Effect.succeed(emptyConfig)
          : Effect.fail(ioError(path, cause)),
      onSuccess: (text) => {
        const parsed = parseConfig(text);
        if (parsed.status === "ok") return Effect.succeed(parsed.config);
        return Effect.fail(
          new ConfigUnreadable({
            path,
            reason: parsed.status,
            detail:
              parsed.status === "invalid" ? parsed.detail : "unknown format",
          }),
        );
      },
    }),
  );

  const save = (config: ConfigFile) =>
    load.pipe(
      Effect.andThen(
        Effect.tryPromise({
          try: async () => {
            await mkdir(dirname(path), { recursive: true, mode: 0o700 });
            const temporary = `${path}.${process.pid}.tmp`;
            await writeFile(temporary, serializeConfig(config), {
              mode: 0o600,
            });
            await chmod(temporary, 0o600);
            await rename(temporary, path);
          },
          catch: (cause) => ioError(path, cause),
        }),
      ),
    );

  return { path, load, save };
}

export const ConfigStoreLive = Layer.effect(
  ConfigStore,
  Effect.gen(function* () {
    const environment = yield* CliEnvironment;
    return makeConfigStore(configPath(environment.env, environment.home));
  }),
);
