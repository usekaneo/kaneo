export async function isMaintainer(github, author) {
  if (typeof author !== "string" || !author) {
    throw new Error("Missing pull request author.");
  }
  const access = await github.request(
    `/repos/${github.repository}/collaborators/${encodeURIComponent(author)}/permission`,
  );
  // GitHub maps maintain and custom roles to their effective base permission.
  const permission = access?.permission;
  if (!["none", "read", "write", "admin"].includes(permission)) {
    throw new Error("GitHub did not return a valid author permission.");
  }
  return permission === "write" || permission === "admin";
}
