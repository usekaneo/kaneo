export function splitRoles(role: string | null | undefined): string[] {
  if (typeof role !== "string") return [];
  const names = role
    .split(",")
    // Stored owner grants must agree with the provider and project access.
    // Never turn a legacy padded token into a new ownership grant on read.
    .filter((name) => name.trim() !== "owner" || name === "owner")
    .map((name) => name.trim())
    .filter(Boolean);
  return [...new Set(names)];
}
