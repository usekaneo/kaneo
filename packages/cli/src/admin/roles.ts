import { Result } from "effect";
import { InvalidArgument } from "../errors/errors.js";

export const BUILT_IN_ROLES = ["owner", "admin", "member", "viewer"] as const;

export function roleParts(role: string): string[] {
  return role
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

export function roleLabel(role: string): string {
  return roleParts(role)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(", ");
}

export function hasRole(role: string, wanted: string): boolean {
  return roleParts(role).includes(wanted);
}

export function roleRank(role: string): number {
  if (hasRole(role, "owner")) return 0;
  if (hasRole(role, "admin")) return 1;
  if (hasRole(role, "member")) return 2;
  if (hasRole(role, "viewer")) return 4;
  return 3;
}

export function isDemotion(from: string, to: string): boolean {
  if (hasRole(from, "owner")) return !hasRole(to, "owner");
  if (hasRole(from, "admin")) {
    return !hasRole(to, "owner") && !hasRole(to, "admin");
  }
  return false;
}

export function needsCustomRoles(input: string): boolean {
  const role = input.trim().toLowerCase();
  return !(BUILT_IN_ROLES as ReadonlyArray<string>).includes(role);
}

export function checkRole(
  input: string,
  customRoles: ReadonlyArray<string>,
): Result.Result<string, InvalidArgument> {
  const role = input.trim().toLowerCase();
  const known = [
    ...BUILT_IN_ROLES,
    ...customRoles.filter(
      (custom) => !(BUILT_IN_ROLES as ReadonlyArray<string>).includes(custom),
    ),
  ];
  const match = known.find((candidate) => candidate.toLowerCase() === role);
  if (match) return Result.succeed(match);
  const custom = known.slice(BUILT_IN_ROLES.length);
  return Result.fail(
    new InvalidArgument({
      message:
        role === ""
          ? "A role is required."
          : `"${input.trim()}" is not a role in this workspace.`,
      hint:
        custom.length > 0
          ? `Use owner, admin, member, viewer, or a custom role: ${custom.join(", ")}.`
          : "Use owner, admin, member or viewer.",
    }),
  );
}
