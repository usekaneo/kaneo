export function splitRoles(role: string | null | undefined): string[] {
  if (typeof role !== "string") return [];
  const names = role
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  return [...new Set(names)];
}
