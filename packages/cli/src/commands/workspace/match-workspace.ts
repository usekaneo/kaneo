import type { Workspace } from "../../api/schemas.js";

export type WorkspaceMatch =
  | { readonly kind: "found"; readonly workspace: Workspace }
  | {
      readonly kind: "ambiguous";
      readonly candidates: ReadonlyArray<Workspace>;
    }
  | { readonly kind: "none" };

function normalize(value: string): string {
  return value.normalize("NFKC").trim().toLowerCase();
}

export function matchWorkspace(
  workspaces: ReadonlyArray<Workspace>,
  reference: string,
): WorkspaceMatch {
  const trimmed = reference.trim();
  const wanted = normalize(reference);
  const tiers = [
    workspaces.filter((workspace) => workspace.id === trimmed),
    workspaces.filter((workspace) => normalize(workspace.slug) === wanted),
    workspaces.filter((workspace) => normalize(workspace.name) === wanted),
  ];
  for (const tier of tiers) {
    const [first] = tier;
    if (!first) continue;
    return tier.length === 1
      ? { kind: "found", workspace: first }
      : { kind: "ambiguous", candidates: tier };
  }
  return { kind: "none" };
}
