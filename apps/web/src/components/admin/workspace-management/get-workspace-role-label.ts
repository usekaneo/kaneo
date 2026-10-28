const BUILT_IN_ROLE_LABEL_KEYS = new Map([
  ["owner", "team:roles.owner"],
  ["admin", "team:roles.admin"],
  ["member", "team:roles.member"],
  ["viewer", "team:roles.viewer"],
]);

export function getWorkspaceRoleLabel(
  role: string,
  t: (key: string) => string,
) {
  return role
    .split(",")
    .filter((name) => name !== "")
    .map((name) => {
      const key = BUILT_IN_ROLE_LABEL_KEYS.get(name);
      return key ? t(key) : name;
    })
    .join(", ");
}
