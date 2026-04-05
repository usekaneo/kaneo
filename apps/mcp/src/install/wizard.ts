import prompts from "prompts";
import { INSTALL_TARGETS, type InstallTargetId } from "./targets.js";

function onCancel(): void {
  console.log("\nCancelled.");
  process.exit(0);
}

export async function promptTargetSelect(): Promise<InstallTargetId[]> {
  const answer = await prompts(
    {
      type: "multiselect",
      name: "targets",
      message: "Where should Kaneo register this MCP server?",
      choices: INSTALL_TARGETS.map((t) => ({
        title: t.label,
        description: t.description,
        value: t.id,
      })),
      hint: "- Space to select. Enter to confirm.",
      min: 1,
      instructions: false,
    },
    { onCancel },
  );

  if (
    answer.targets === undefined ||
    !Array.isArray(answer.targets) ||
    answer.targets.length === 0
  ) {
    onCancel();
  }

  return answer.targets as InstallTargetId[];
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
