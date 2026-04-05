import { homedir } from "node:os";
import { join } from "node:path";

export type InstallTargetId =
  | "cursor-user"
  | "cursor-project"
  | "claude-desktop"
  | "custom";

export type InstallTarget = {
  id: InstallTargetId;
  label: string;
  description: string;
};

export const INSTALL_TARGETS: readonly InstallTarget[] = [
  {
    id: "cursor-user",
    label: "Cursor (user-wide)",
    description: "~/.cursor/mcp.json — available in all projects",
  },
  {
    id: "cursor-project",
    label: "Cursor (this project only)",
    description: ".cursor/mcp.json in the current directory",
  },
  {
    id: "claude-desktop",
    label: "Claude Desktop",
    description: "claude_desktop_config.json for the Claude app",
  },
  {
    id: "custom",
    label: "Custom file path",
    description: "Any JSON file you choose (advanced)",
  },
];

export function getClaudeDesktopConfigPath(): string {
  const platform = process.platform;
  if (platform === "darwin") {
    return join(
      homedir(),
      "Library",
      "Application Support",
      "Claude",
      "claude_desktop_config.json",
    );
  }
  if (platform === "win32") {
    const appData = process.env.APPDATA;
    if (!appData) {
      throw new Error("APPDATA is not set; cannot resolve Claude Desktop path");
    }
    return join(appData, "Claude", "claude_desktop_config.json");
  }
  return join(homedir(), ".config", "Claude", "claude_desktop_config.json");
}

export function resolveTargetConfigPath(
  id: InstallTargetId,
  options: { cwd: string; customPath?: string },
): string {
  switch (id) {
    case "cursor-user":
      return join(homedir(), ".cursor", "mcp.json");
    case "cursor-project":
      return join(options.cwd, ".cursor", "mcp.json");
    case "claude-desktop":
      return getClaudeDesktopConfigPath();
    case "custom": {
      const p = options.customPath?.trim();
      if (!p) {
        throw new Error("Custom target requires a file path");
      }
      return p;
    }
  }
}
