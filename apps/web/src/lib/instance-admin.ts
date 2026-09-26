export function hasInstanceAdminRole(role: unknown): boolean {
  return (
    typeof role === "string" &&
    role
      .split(",")
      .map((entry) => entry.trim())
      .includes("admin")
  );
}
