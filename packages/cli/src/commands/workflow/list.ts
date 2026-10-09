import { Effect, Option } from "effect";
import { Command, Flag } from "effect/cli";
import { listWorkflowRules } from "../../api/workflow-rules.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import {
  resolveProject,
  resolveWorkspaceId,
} from "../../services/selection.js";
import { sortRules } from "../../workflow/sort-rules.js";
import { renderRuleList } from "../../workflow/render-rules.js";
import { toRuleJson } from "../../workflow/rule-json.js";
import { ApiLayer } from "../api-layer.js";

export const runWorkflowList = Effect.fn("command.workflow.list")(
  function* (options: { readonly project: Option.Option<string> }) {
    const workspaceId = yield* resolveWorkspaceId();
    const project = yield* resolveProject(workspaceId, options.project);
    const rules = yield* withSpinner("Loading workflow rules")(
      listWorkflowRules(project.id),
    );
    yield* emit(sortRules(rules.map(toRuleJson)), (ui, value) =>
      renderRuleList(ui, { projectName: project.name, rules: value }),
    );
  },
);

export const workflowList = Command.make(
  "list",
  {
    project: Flag.String("project").pipe(
      Flag.withAlias("p"),
      Flag.withDescription("Project key or id, for example KAN"),
      Flag.optional,
    ),
  },
  (options) => runWorkflowList(options),
).pipe(
  Command.withDescription(
    "List the rules that move tasks when GitHub, GitLab or Gitea events arrive",
  ),
  Command.provide(ApiLayer),
);
