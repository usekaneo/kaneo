import type { PermissionRequirement } from "@kaneo/plugin-sdk/server";

export function toPermissionMap(
  permissions: PermissionRequirement | undefined,
): Record<string, string[]> | null {
  const entries = Object.entries(permissions ?? {}).filter(
    (entry): entry is [string, string[]] =>
      Array.isArray(entry[1]) && entry[1].length > 0,
  );
  return entries.length > 0 ? Object.fromEntries(entries) : null;
}
