import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { errorMessage } from "@kaneo/plugin-loader";
import { Context, Effect, Layer } from "effect";
import { InvalidArgument } from "../errors/errors.js";
import { Output } from "../output/output.js";
import {
  installArgs,
  lastErrorLine,
  npmCommand,
  npmEnv,
  releasesArgs,
} from "../plugins/npm-args.js";
import { type NpmViewResult, parseNpmView } from "../plugins/parse-npm-view.js";
import { CliEnvironment } from "./cli-environment.js";

export type NpmInstallResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly message: string | null };

export type NpmShape = {
  readonly releases: (
    cwd: string,
    packageName: string,
  ) => Effect.Effect<NpmViewResult, InvalidArgument>;
  readonly install: (
    cwd: string,
    specs: ReadonlyArray<string>,
  ) => Effect.Effect<NpmInstallResult, InvalidArgument>;
};

export class Npm extends Context.Service<Npm, NpmShape>()("kaneo/Npm") {}

type NpmRun = { code: number; stdout: string; stderr: string };

type RunOptions = {
  readonly cwd: string;
  readonly env: Record<string, string | undefined>;
  readonly platform: string;
  readonly show: boolean;
};

function runNpm(args: string[], options: RunOptions): Promise<NpmRun> {
  const { command, args: argv, shell } = npmCommand(options.platform, args);
  return new Promise((resolve, reject) => {
    const child = spawn(command, argv, {
      cwd: options.cwd,
      env: options.env,
      shell,
      stdio: options.show ? ["ignore", 2, 2] : ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

function startFailure(error: unknown): InvalidArgument {
  return (error as NodeJS.ErrnoException).code === "ENOENT"
    ? new InvalidArgument({
        message:
          "npm was not found. Install Node.js with npm, or run kaneo plugin add in the Kaneo Docker image.",
      })
    : new InvalidArgument({
        message: `npm could not start: ${errorMessage(error)}`,
      });
}

export const NpmLive = Layer.effect(
  Npm,
  Effect.gen(function* () {
    const output = yield* Output;
    const environment = yield* CliEnvironment;
    const cacheDir = yield* Effect.acquireRelease(
      Effect.tryPromise({
        try: () => mkdtemp(join(tmpdir(), "kaneo-npm-cache-")),
        catch: (error) =>
          new InvalidArgument({
            message: `Could not create a temporary npm cache: ${errorMessage(error)}`,
          }),
      }),
      (dir) => Effect.promise(() => rm(dir, { recursive: true, force: true })),
    );
    const env = npmEnv(environment.env, cacheDir);
    const run = (cwd: string, args: string[], show: boolean) =>
      Effect.tryPromise({
        try: () =>
          runNpm(args, { cwd, env, platform: environment.platform, show }),
        catch: startFailure,
      });

    return {
      releases: (cwd, packageName) =>
        run(cwd, releasesArgs(packageName), false).pipe(
          Effect.map((result) =>
            parseNpmView(result.stdout, result.stderr, result.code),
          ),
        ),
      install: (cwd, specs) =>
        run(cwd, installArgs(specs), output.mode === "human").pipe(
          Effect.map((result): NpmInstallResult =>
            result.code === 0
              ? { ok: true }
              : { ok: false, message: lastErrorLine(result.stderr) },
          ),
        ),
    };
  }),
);
