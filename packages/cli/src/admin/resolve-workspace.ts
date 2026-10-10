import { Effect, Option } from "effect";
import { fromOrganizations } from "../api/from-organizations.js";
import type { Workspace } from "../api/schemas.js";
import {
  listOrganizations,
  type Organization,
} from "../api/workspace-admin.js";
import { matchWorkspace } from "../commands/workspace/match-workspace.js";
import { InvalidArgument, NotFound } from "../errors/errors.js";
import { withSpinner } from "../output/spinner.js";
import { resolveWorkspaceId } from "../services/selection.js";

export type ResolvedWorkspace = {
  readonly workspace: Workspace;
  readonly organization: Organization;
};

export const resolveWorkspace = Effect.fn("admin.resolveWorkspace")(function* (
  reference: Option.Option<string>,
) {
  const wantedId = Option.isNone(reference)
    ? yield* resolveWorkspaceId()
    : undefined;
  const organizations =
    yield* withSpinner("Loading workspaces")(listOrganizations());
  const workspaces = fromOrganizations(organizations);
  const found = (workspace: Workspace) => {
    const organization = organizations.find(
      (candidate) => candidate.id === workspace.id,
    );
    return organization
      ? Effect.succeed<ResolvedWorkspace>({ workspace, organization })
      : Effect.fail(
          new NotFound({ message: `Workspace ${workspace.id} not found.` }),
        );
  };
  if (wantedId !== undefined) {
    const workspace = workspaces.find((candidate) => candidate.id === wantedId);
    if (workspace) return yield* found(workspace);
    return yield* new NotFound({
      message: `You are not a member of the workspace ${wantedId}.`,
    });
  }
  const text = Option.getOrElse(reference, () => "");
  const match = matchWorkspace(workspaces, text);
  if (match.kind === "found") return yield* found(match.workspace);
  if (match.kind === "ambiguous") {
    return yield* new InvalidArgument({
      message: `"${text}" matches ${match.candidates.length} workspaces.`,
      hint: `Use a slug instead: ${match.candidates.map((workspace) => workspace.slug).join(", ")}.`,
    });
  }
  return yield* new InvalidArgument({
    message: `No workspace matches "${text}".`,
    hint: "Run kaneo workspace list to see your workspaces.",
  });
});
