const INSTANCE_ADMIN_ROLE = "admin";

export function hasInstanceAdminRole(role: unknown) {
  return (
    typeof role === "string" && role.split(",").includes(INSTANCE_ADMIN_ROLE)
  );
}
