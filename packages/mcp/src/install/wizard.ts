import prompts from "prompts";
import {
  INSTALL_TARGETS,
  type InstallTargetId,
  validateCustomConfigPathInput,
} from "./targets.js";

function onCancel(): never {
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
      validate: (v) => {
        if (typeof v !== "string") {
          return "Path is required";
        }
        const result = validateCustomConfigPathInput(v);
        return result.ok ? true : result.message;
      },
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
  configPath: string,
): Promise<boolean> {
  const answer = await prompts(
    {
      type: "confirm",
      name: "overwrite",
      message: `MCP server "${serverName}" is already in this file (${configPath}). Overwrite it?`,
      initial: false,
    },
    { onCancel },
  );

  if (answer.overwrite === undefined) {
    onCancel();
  }

  return Boolean(answer.overwrite);
}
