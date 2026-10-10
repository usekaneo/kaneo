export type NpmCommand = {
  readonly command: string;
  readonly args: string[];
  readonly shell: boolean;
};

export function npmEnv(
  base: Readonly<Record<string, string | undefined>>,
  cacheDir: string,
): Record<string, string | undefined> {
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

export function npmCommand(
  platform: string,
  args: readonly string[],
): NpmCommand {
  return platform === "win32"
    ? { command: "npm", args: args.map((arg) => `"${arg}"`), shell: true }
    : { command: "npm", args: [...args], shell: false };
}

export function lastErrorLine(stderr: string): string | null {
  const lines = stderr
    .split("\n")
    .map((line) => line.replace(/^npm (?:error|ERR!)\s*/, "").trim())
    .filter(Boolean);
  return lines.at(-1) ?? null;
}
