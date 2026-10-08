import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CliError } from "../../cli-error";
import { type NpmViewResult, parseNpmView } from "./parse-npm-view";

export type Npm = {
  releases(packageName: string): Promise<NpmViewResult>;
  install(specs: readonly string[]): Promise<boolean>;
};

type NpmRun = { code: number; stdout: string; stderr: string };

export function npmEnv(
  base: NodeJS.ProcessEnv,
  cacheDir: string,
): NodeJS.ProcessEnv {
  return {
    ...base,
    npm_config_cache: cacheDir,
    npm_config_update_notifier: "false",
    npm_config_fund: "false",
  };
}

export function releasesArgs(packageName: string): string[] {
  return [
    "view",
    `${packageName}@>=0.0.0`,
    "name",
    "version",
    "engines",
    "deprecated",
    "--json",
  ];
}

export function installArgs(specs: readonly string[]): string[] {
  return ["install", "--save-exact", ...specs];
}

function runNpm(
  args: string[],
  {
    cwd,
    env,
    capture,
  }: { cwd: string; env: NodeJS.ProcessEnv; capture: boolean },
): Promise<NpmRun> {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", args, {
      cwd,
      env,
      stdio: capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.setEncoding("utf8").on("data", (chunk: string) => {
      stdout += chunk;
    });
    child.stderr?.setEncoding("utf8").on("data", (chunk: string) => {
      stderr += chunk;
    });
    child.on("error", (error: NodeJS.ErrnoException) => {
      reject(
        error.code === "ENOENT"
          ? new CliError(
              "npm was not found. Install Node.js with npm, or run kaneo add in the Kaneo Docker image.",
            )
          : error,
      );
    });
    child.on("close", (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}

export async function withNpm<T>(
  cwd: string,
  run: (npm: Npm) => Promise<T>,
): Promise<T> {
  const cacheDir = await mkdtemp(join(tmpdir(), "kaneo-npm-cache-"));
  const env = npmEnv(process.env, cacheDir);
  try {
    return await run({
      async releases(packageName) {
        const result = await runNpm(releasesArgs(packageName), {
          cwd,
          env,
          capture: true,
        });
        return parseNpmView(result.stdout, result.stderr, result.code);
      },
      async install(specs) {
        const result = await runNpm(installArgs(specs), {
          cwd,
          env,
          capture: false,
        });
        return result.code === 0;
      },
    });
  } finally {
    await rm(cacheDir, { recursive: true, force: true });
  }
}
