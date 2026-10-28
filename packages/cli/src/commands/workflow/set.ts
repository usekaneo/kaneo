import { Effect, Option, Result } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { listColumns } from "../../api/endpoints.js";
import { upsertWorkflowRule } from "../../api/workflow-rules.js";
import { InvalidArgument } from "../../errors/errors.js";
import { emit } from "../../output/emit.js";
import { Output } from "../../output/output.js";
import { withSpinner } from "../../output/spinner.js";
import { type Choice, pick } from "../../prompts/pick.js";
import {
  resolveProject,
  resolveWorkspaceId,
} from "../../services/selection.js";
import { matchColumn } from "../../tasks/match-column.js";
import {
  EVENT_LABELS,
  EVENTS,
  INTEGRATION_LABELS,
  INTEGRATIONS,
  parseIntegration,
  parseWorkflowEvent,
} from "../../workflow/events.js";
import { renderRuleChange } from "../../workflow/render-rules.js";
import type { RuleJson } from "../../workflow/rule-json.js";
import { ApiLayer } from "../api-layer.js";

const USAGE = "kaneo workflow set github pr_merged done";

const choose = Effect.fnUntraced(function* <A>(
  input: Option.Option<string>,
  parse: (value: string) => Result.Result<A, InvalidArgument>,
  question: string,
  choices: ReadonlyArray<Choice<A>>,
  missing: string,
) {
  const output = yield* Output;
  if (Option.isSome(input)) return yield* Effect.fromResult(parse(input.value));
  if (output.interactive) return yield* pick(question, choices);
  return yield* new InvalidArgument({
    message: missing,
    hint: `Pass the integration, the event and the column, for example ${USAGE}.`,
  });
});

export const runWorkflowSet = Effect.fn("command.workflow.set")(
  function* (options: {
    readonly integration: Option.Option<string>;
    readonly event: Option.Option<string>;
    readonly column: Option.Option<string>;
    readonly project: Option.Option<string>;
  }) {
    const integration = yield* choose(
      options.integration,
      parseIntegration,
      "Which integration?",
      INTEGRATIONS.map((value) => ({
        title: INTEGRATION_LABELS[value],
        value,
      })),
      "Which integration does the rule listen to?",
    );
    const event = yield* choose(
      options.event,
      parseWorkflowEvent,
      "When this happens",
      EVENTS.map((value) => ({
        title: EVENT_LABELS[value],
        value,
        description: value,
      })),
      "Which event should move tasks?",
    );
    const workspaceId = yield* resolveWorkspaceId();
    const project = yield* resolveProject(workspaceId, options.project);
    const columns = yield* withSpinner("Loading columns")(
      listColumns(project.id),
    );
    const column = yield* choose(
      options.column,
      (reference) => {
        const match = matchColumn(columns, reference);
        return match
          ? Result.succeed(match)
          : Result.fail(
              new InvalidArgument({
                message: `No column matches "${reference}" in ${project.name}.`,
                hint: `Columns: ${columns.map((entry) => entry.slug).join(", ")}.`,
              }),
            );
      },
      "Move the task to",
      columns.map((entry) => ({ title: entry.name, value: entry })),
      "Which column should tasks move to?",
    );

    const saved = yield* withSpinner("Saving the rule")(
      upsertWorkflowRule(project.id, {
        integrationType: integration,
        eventType: event,
        columnId: column.id,
      }),
    );
    const rule: RuleJson = {
      id: saved.id,
      integration: saved.integrationType,
      event: saved.eventType,
      column: { id: column.id, name: column.name, slug: column.slug },
    };
    yield* emit(rule, (ui, value) =>
      renderRuleChange(ui, { verb: "Set", rule: value }),
    );
  },
);

export const workflowSet = Command.make(
  "set",
  {
    integration: Argument.String("integration").pipe(
      Argument.withDescription("github, gitlab or gitea"),
      Argument.optional,
    ),
    event: Argument.String("event").pipe(
      Argument.withDescription(
        "branch_push, pr_opened, pr_merged, issue_opened, issue_closed or issue_reopened",
      ),
      Argument.optional,
    ),
    column: Argument.String("column").pipe(
      Argument.withDescription("Column slug or name, such as done"),
      Argument.optional,
    ),
    project: Flag.String("project").pipe(
      Flag.withAlias("p"),
      Flag.withDescription("Project key or id, for example KAN"),
      Flag.optional,
    ),
  },
  (options) => runWorkflowSet(options),
).pipe(
  Command.withDescription(
    "Choose the column tasks move to when an integration event arrives",
  ),
  Command.provide(ApiLayer),
);
