import { Effect, Option } from "effect";
import { Command } from "effect/cli";
import { listWorkspaces } from "../../api/endpoints.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { Session } from "../../services/session.js";
import { ApiLayer } from "../api-layer.js";
import { renderWorkspaceList } from "./render-workspace-list.js";
import { toWorkspaceJson } from "./workspace-json.js";

export const runWorkspaceList = Effect.fn("command.workspace.list")(
  function* () {
    const session = yield* Session;
    const workspaces =
      yield* withSpinner("Loading workspaces")(listWorkspaces());
    const activeId = Option.getOrUndefined(session.workspace)?.id;
    yield* emit(
      workspaces.map((workspace) => toWorkspaceJson(workspace, activeId)),
      renderWorkspaceList,
    );
  },
);

export const workspaceList = Command.make("list", {}, () =>
  runWorkspaceList(),
).pipe(
  Command.withDescription("List the workspaces you belong to"),
  Command.provide(ApiLayer),
);
