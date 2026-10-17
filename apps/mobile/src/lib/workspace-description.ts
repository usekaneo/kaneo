import type { FullOrganization, Json } from "./api/types";

export function getWorkspaceDescription(
  workspace: Pick<FullOrganization, "description" | "metadata">,
): string {
  if (workspace.description?.trim()) return workspace.description;
  const metadata = parseMetadata(workspace.metadata);
  return typeof metadata?.description === "string" ? metadata.description : "";
}

export function workspaceDescriptionUpdate(
  description: string,
  metadata: Json | undefined,
): { description: string; metadata?: Record<string, Json> } {
  const parsed = parseMetadata(metadata);
  // Keep a legacy description in sync, including when clearing the column:
  // the API falls back to metadata when the column is blank.
  if (parsed && "description" in parsed) {
    return { description, metadata: { ...parsed, description } };
  }
  return { description };
}

function parseMetadata(
  metadata: Json | undefined,
): Record<string, Json> | undefined {
  let parsed = metadata;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed) as Json;
    } catch {
      return undefined;
    }
  }
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? parsed
    : undefined;
}
