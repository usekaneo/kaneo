// Request roles need normalization before either provider owner checks or
// project access checks. Invalid shapes remain for the provider to reject.
export function normalizeInvitationRole(role: unknown): string | undefined {
  if (
    typeof role !== "string" &&
    !(Array.isArray(role) && role.every((name) => typeof name === "string"))
  ) {
    return undefined;
  }
  const roles: string[] = typeof role === "string" ? [role] : role;
  return [
    ...new Set(
      roles
        .flatMap((name) => name.split(",").map((token) => token.trim()))
        .filter(Boolean),
    ),
  ].join(",");
}
