export function isOwnerRole(role: string | null | undefined) {
  return typeof role === "string" && role.split(",").includes("owner");
}
