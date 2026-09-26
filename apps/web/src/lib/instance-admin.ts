const INSTANCE_ADMIN_ROLE = "admin";
const DEFAULT_ROLE = "user";

function roleTokens(role: unknown) {
  const tokens =
    typeof role === "string"
      ? role.split(",").filter((token) => token !== "")
      : [];
  return tokens.length > 0 ? tokens : [DEFAULT_ROLE];
}

export function hasInstanceAdminRole(role: unknown) {
  return (
    typeof role === "string" && role.split(",").includes(INSTANCE_ADMIN_ROLE)
  );
}

export function withInstanceAdminRole(role: unknown, admin: boolean) {
  const tokens = roleTokens(role);
  if (admin) {
    return tokens.includes(INSTANCE_ADMIN_ROLE)
      ? tokens.join(",")
      : [...tokens, INSTANCE_ADMIN_ROLE].join(",");
  }
  const remaining = tokens.filter((token) => token !== INSTANCE_ADMIN_ROLE);
  return remaining.length > 0 ? remaining.join(",") : DEFAULT_ROLE;
}
