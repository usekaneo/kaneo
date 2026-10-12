function nonBlank(value: unknown) {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function parseMetadata(metadata: string | null): unknown {
  if (!metadata) return null;
  try {
    return JSON.parse(metadata);
  } catch {
    return null;
  }
}

export function resolveWorkspaceDescription(workspace: {
  description: string | null;
  metadata: string | null;
}) {
  const description = nonBlank(workspace.description);
  if (description !== null) return description;

  const metadata = parseMetadata(workspace.metadata);
  if (typeof metadata !== "object" || metadata === null) return null;
  if (Array.isArray(metadata)) return null;

  return nonBlank((metadata as { description?: unknown }).description);
}
