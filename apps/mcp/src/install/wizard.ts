import prompts from "prompts";
import { INSTALL_TARGETS, type InstallTargetId } from "./targets.js";

function onCancel(): void {
  console.log("\nCancelled.");
  process.exit(0);
}

function printIntro(): void {
  console.log(`
────────────────────────────────────────
  Kaneo MCP  ·  editor setup
────────────────────────────────────────
  Use ↑ / ↓ to move, Enter to select.
────────────────────────────────────────
`);
}

export async function promptTargetSelect(): Promise<InstallTargetId> {
  printIntro();
  const answer = await prompts(
    {
      type: "select",
      name: "target",
      message: "Where should Kaneo register this MCP server?",
      choices: INSTALL_TARGETS.map((t) => ({
        title: t.label,
        description: t.description,
        value: t.id,
      })),
      initial: 0,
    },
    { onCancel },
  );

  if (answer.target === undefined) {
    onCancel();
  }

  return answer.target as InstallTargetId;
}

export async function promptCustomConfigPath(): Promise<string> {
  const answer = await prompts(
    {
      type: "text",
      name: "path",
      message: "Absolute path to the JSON config file (create or update):",
      validate: (v) =>
        typeof v === "string" && v.trim().length > 0
          ? true
          : "Path is required",
    },
    { onCancel },
  );

  if (answer.path === undefined) {
    onCancel();
  }

  return String(answer.path).trim();
}

export async function promptConfirmOverwrite(
  serverName: string,
): Promise<boolean> {
  const answer = await prompts(
    {
      type: "confirm",
      name: "overwrite",
      message: `MCP server "${serverName}" is already in this file. Overwrite it?`,
      initial: false,
    },
    { onCancel },
  );

  if (answer.overwrite === undefined) {
    onCancel();
  }

  return Boolean(answer.overwrite);
}
