import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { devApiUrl, devEnvironment } from "./dev-environment.js";

const fromCli = (path: string) =>
  fileURLToPath(new URL(`../../${path}`, import.meta.url));

function readRootEnv(): string | undefined {
  try {
    return readFileSync(fromCli("../../.env"), "utf8");
  } catch {
    return undefined;
  }
}

const configPath = fromCli(".kaneo-dev/config.json");
const args = process.argv.slice(2);

// The CLI's own hints say `kaneo login`, which signs in the installed CLI.
if (!existsSync(configPath) && !args.includes("login")) {
  console.error(
    "No dev login yet. Sign in to the dev API with `pnpm --filter @kaneo/cli dev login`.",
  );
}

Object.assign(
  process.env,
  devEnvironment(process.env, configPath, devApiUrl(readRootEnv())),
);

const { main } = await import("../main.js");
main(args);
