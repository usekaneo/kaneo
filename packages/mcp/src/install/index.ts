import { chmod, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { stdin as input, stdout as output } from "node:process";
import { type McpServerEntry, mergeMcpServerEntry } from "./merge-config.js";
import { resolvePackageEntryPath } from "./resolve-entry.js";
import {
  INSTALL_TARGETS,
  type InstallTargetId,
  resolveTargetConfigPath,
  validateCustomConfigPathInput,
} from "./targets.js";
import {
  promptConfirmOverwrite,
  promptCustomConfigPath,
  promptTargetSelect,
} from "./wizard.js";

/** True if `v` looks like a CLI flag (`--long` or single-letter `-y`), not a value like `-my-server`. */
function isFlagLikeToken(v: string): boolean {
  if (v.startsWith("--")) {
    return true;
  }
  return /^-[A-Za-z]$/.test(v);
}

export type ParsedInstallArgs = {
  target?: string;
  output?: string;
  name: string;
  yes: boolean;
  apiUrl?: string;
  projectDir: string;
  help: boolean;
};

export function parseInstallArgs(argv: string[]): ParsedInstallArgs {
  let target: string | undefined;
  let output: string | undefined;
  let name = "kaneo";
  let yes = false;
  let apiUrl: string | undefined;
  let projectDir = process.cwd();
  let help = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === undefined) {
      continue;
    }
    if (a === "-h" || a === "--help") {
      help = true;
      continue;
    }
    if (a === "-y" || a === "--yes") {
      yes = true;
      continue;
    }
    if (a === "--target") {
      const v = argv[i + 1];
      if (!v || isFlagLikeToken(v)) {
        throw new Error("--target requires a value");
      }
      target = v;
      i++;
      continue;
    }
    if (a.startsWith("--target=")) {
      target = a.slice("--target=".length);
      continue;
    }
    if (a === "--output") {
      const v = argv[i + 1];
      if (!v || isFlagLikeToken(v)) {
        throw new Error("--output requires a value");
      }
      output = v;
      i++;
      continue;
    }
    if (a.startsWith("--output=")) {
      output = a.slice("--output=".length);
      continue;
    }
    if (a === "--name") {
      const v = argv[i + 1];
      if (!v || isFlagLikeToken(v)) {
        throw new Error("--name requires a value");
      }
      name = v;
      i++;
      continue;
    }
    if (a.startsWith("--name=")) {
      name = a.slice("--name=".length);
      continue;
    }
    if (a === "--api-url") {
      const v = argv[i + 1];
      if (!v || isFlagLikeToken(v)) {
        throw new Error("--api-url requires a value");
      }
      apiUrl = v;
      i++;
      continue;
    }
    if (a.startsWith("--api-url=")) {
      apiUrl = a.slice("--api-url=".length);
      continue;
    }
    if (a === "--project-dir") {
      const v = argv[i + 1];
      if (!v || isFlagLikeToken(v)) {
        throw new Error("--project-dir requires a value");
      }
      projectDir = v;
      i++;
      continue;
    }
    if (a.startsWith("--project-dir=")) {
      projectDir = a.slice("--project-dir=".length);
      continue;
    }
    throw new Error(`Unknown option: ${a}`);
  }

  return { target, output, name, yes, apiUrl, projectDir, help };
}

function hasExistingServerEntry(
  jsonText: string | null,
  serverName: string,
): boolean {
  if (!jsonText) {
    return false;
  }
  try {
    const root = JSON.parse(jsonText) as unknown;
    if (!root || typeof root !== "object" || Array.isArray(root)) {
      return false;
    }
    const m = (root as { mcpServers?: unknown }).mcpServers;
    if (!m || typeof m !== "object" || Array.isArray(m)) {
      return false;
    }
    return Object.hasOwn(m as object, serverName);
  } catch {
    return false;
  }
}

const VALID_TARGETS: readonly InstallTargetId[] = INSTALL_TARGETS.map(
  (t) => t.id,
);

function isInstallTargetId(s: string): s is InstallTargetId {
  return (VALID_TARGETS as readonly string[]).includes(s);
}

export async function runInstall(argv: string[]): Promise<void> {
  let parsed: ParsedInstallArgs;
  try {
    parsed = parseInstallArgs(argv);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    printInstallHelp();
    process.exitCode = 1;
    return;
  }

  if (parsed.help) {
    printInstallHelp();
    return;
  }

  if (parsed.target !== undefined && !isInstallTargetId(parsed.target)) {
    console.error(`Invalid --target. Use one of: ${VALID_TARGETS.join(", ")}`);
    process.exitCode = 1;
    return;
  }

  if (!parsed.name.trim()) {
    console.error("--name must be a non-empty string.");
    process.exitCode = 1;
    return;
  }

  let targetIds = parsed.target
    ? [parsed.target as InstallTargetId]
    : undefined;
  const needsInteractive =
    input.isTTY && output.isTTY && !parsed.yes && targetIds === undefined;

  if (needsInteractive) {
    targetIds = await promptTargetSelect();
  } else if (targetIds === undefined) {
    console.error(
      "Non-interactive mode: specify --target (e.g. --target cursor-user) and use -y to confirm.",
    );
    printInstallHelp();
    process.exitCode = 1;
    return;
  }

  let customPath = parsed.output?.trim();
  if (targetIds.includes("custom")) {
    if (!customPath) {
      if (input.isTTY && output.isTTY) {
        customPath = await promptCustomConfigPath();
      } else {
        console.error("Custom target requires --output <path>");
        process.exitCode = 1;
        return;
      }
    } else {
      const validation = validateCustomConfigPathInput(customPath);
      if (!validation.ok) {
        console.error(`Invalid --output: ${validation.message}`);
        process.exitCode = 1;
        return;
      }
      customPath = validation.path;
    }
  }

  const entryPath = resolvePackageEntryPath();
  const env =
    parsed.apiUrl !== undefined && parsed.apiUrl.length > 0
      ? { KANEO_API_URL: parsed.apiUrl }
      : undefined;

  const serverConfig: McpServerEntry = {
    command: process.execPath,
    args: [entryPath],
    ...(env ? { env } : {}),
  };

  const writtenPaths: string[] = [];
  const pending: Array<{ configPath: string; existingText: string | null }> =
    [];

  for (const targetId of targetIds) {
    const configPath = resolveTargetConfigPath(targetId, {
      cwd: parsed.projectDir,
      customPath,
    });

    let existingText: string | null = null;
    try {
      existingText = await readFile(configPath, "utf8");
    } catch (err: unknown) {
      const code =
        err &&
        typeof err === "object" &&
        "code" in err &&
        typeof (err as NodeJS.ErrnoException).code === "string"
          ? (err as NodeJS.ErrnoException).code
          : undefined;
      if (code === "ENOENT") {
        existingText = null;
      } else {
        throw err;
      }
    }

    const already = hasExistingServerEntry(existingText, parsed.name);

    if (already && !parsed.yes) {
      if (input.isTTY && output.isTTY) {
        const ok = await promptConfirmOverwrite(parsed.name, configPath);
        if (!ok) {
          console.log(`Skipped:\n  ${configPath}`);
          continue;
        }
      } else {
        console.error(
          `Entry "${parsed.name}" already exists. Pass -y to overwrite.`,
        );
        process.exitCode = 1;
        return;
      }
    }

    pending.push({ configPath, existingText });
  }

  const mergedWrites: Array<{ configPath: string; merged: string }> = [];
  for (const p of pending) {
    let merged: string;
    try {
      merged = mergeMcpServerEntry(p.existingText, parsed.name, serverConfig);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      console.error(
        `Cannot update config at ${p.configPath}: ${message}${stack ? `\n${stack}` : ""}`,
      );
      process.exitCode = 1;
      return;
    }
    mergedWrites.push({ configPath: p.configPath, merged });
  }

  for (const w of mergedWrites) {
    await mkdir(dirname(w.configPath), { recursive: true });
    await writeFile(w.configPath, w.merged, { encoding: "utf8", mode: 0o600 });
    await chmod(w.configPath, 0o600);
    writtenPaths.push(w.configPath);
  }

  if (writtenPaths.length === 0) {
    console.log("No config files were updated.");
    return;
  }

  console.log(`Wrote MCP server "${parsed.name}" to:`);
  for (const configPath of writtenPaths) {
    console.log(`  ${configPath}`);
  }
  console.log("\nRestart your MCP client (or reload the window) if needed.");
}

function printInstallHelp(): void {
  console.log(`kaneo-mcp install — register Kaneo in an MCP client config

Usage:
  kaneo-mcp install [options]

Without options, runs interactively (pick Cursor / Claude / custom path).

Options:
  --target <id>       ${VALID_TARGETS.join(" | ")}
  --output <path>     Required for --target custom (absolute path to JSON file)
  --project-dir <dir> Base directory for cursor-project (default: current dir)
  --name <string>     MCP server key under mcpServers (default: kaneo)
  --api-url <url>     Set KANEO_API_URL in the generated entry (optional)
  -y, --yes           Overwrite existing entry without prompting
  -h, --help          Show this help

Examples:
  npm install -g @kaneo/mcp
  kaneo-mcp install

  kaneo-mcp install --target cursor-user -y
  kaneo-mcp install --target custom --output /path/to/mcp.json -y
`);
}
