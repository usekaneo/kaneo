import type { PluginApiError } from "./types.js";

export function isPluginApiError(error: unknown): error is PluginApiError {
  return (
    error instanceof Error &&
    typeof (error as { status?: unknown }).status === "number"
  );
}
