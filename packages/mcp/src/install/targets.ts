import { homedir } from "node:os";
import path, { join } from "node:path";

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

/**
 * Validates a non-interactive custom MCP config path (same rules as the install wizard).
 * Returns the trimmed absolute path on success.
 */
export function validateCustomConfigPathInput(
  raw: string,
): { ok: true; path: string } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return { ok: false, message: "Path is required" };
  }
  if (!path.isAbsolute(trimmed)) {
    return { ok: false, message: "Path must be absolute" };
  }
  if (!trimmed.toLowerCase().endsWith(".json")) {
    return { ok: false, message: "Path must end with .json" };
  }
  return { ok: true, path: trimmed };
}

export const INSTALL_TARGETS = [
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
] as const satisfies readonly InstallTarget[];

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
      const result = validateCustomConfigPathInput(options.customPath ?? "");
      if (!result.ok) {
        throw new Error(result.message);
      }
      return result.path;
    }
  }
}
