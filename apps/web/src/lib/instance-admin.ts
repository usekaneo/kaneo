export function hasInstanceAdminRole(role: unknown) {
  return (
    typeof role === "string" &&
    role
      .split(",")
      .map((entry) => entry.trim())
      .includes("admin")
  );
}
