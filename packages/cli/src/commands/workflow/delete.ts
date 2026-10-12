import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import {
  deleteWorkflowRule,
  listWorkflowRules,
} from "../../api/workflow-rules.js";
import { InvalidArgument } from "../../errors/errors.js";
import { emit } from "../../output/emit.js";
import { Output } from "../../output/output.js";
import { withSpinner } from "../../output/spinner.js";
import { confirmDestructive } from "../../prompts/confirm-destructive.js";
import { pick } from "../../prompts/pick.js";
import {
  resolveProject,
  resolveWorkspaceId,
} from "../../services/selection.js";
import {
  eventLabel,
  integrationLabel,
  parseIntegration,
  parseWorkflowEvent,
} from "../../workflow/events.js";
import { matchRule } from "../../workflow/match-rule.js";
import { renderRuleChange } from "../../workflow/render-rules.js";
import { type RuleJson, toRuleJson } from "../../workflow/rule-json.js";
import { sortRules } from "../../workflow/sort-rules.js";
import { ApiLayer } from "../api-layer.js";

function ruleName(rule: RuleJson): string {
  return `${integrationLabel(rule.integration)} ${eventLabel(rule.event).toLowerCase()}`;
}

const findRule = Effect.fnUntraced(function* (
  rules: ReadonlyArray<RuleJson>,
  first: Option.Option<string>,
  second: Option.Option<string>,
  projectName: string,
) {
  const output = yield* Output;
  if (Option.isNone(first)) {
    if (output.interactive && rules.length > 0) {
      return yield* pick(
        "Delete which rule?",
        rules.map((rule) => ({
          title: ruleName(rule),
          value: rule,
          description: rule.column.name ?? rule.column.id,
        })),
      );
    }
    return yield* new InvalidArgument({
      message:
        rules.length === 0
          ? `${projectName} has no workflow rules.`
          : "Which rule should be deleted?",
      hint: "Pass the integration and the event, for example kaneo workflow delete github pr_merged, or a rule id.",
    });
  }
  const target = Option.isSome(second)
    ? {
        integration: yield* Effect.fromResult(parseIntegration(first.value)),
        event: yield* Effect.fromResult(parseWorkflowEvent(second.value)),
      }
    : rules.some((rule) => rule.id === first.value.trim())
      ? { id: first.value.trim() }
      : { event: yield* Effect.fromResult(parseWorkflowEvent(first.value)) };
  const match = matchRule(rules, target);
  if (match.kind === "found") return match.rule;
  if (match.kind === "ambiguous") {
    return yield* new InvalidArgument({
      message: `${eventLabel(match.rules[0]?.event ?? "")} has rules for ${match.rules.map((rule) => integrationLabel(rule.integration)).join(" and ")}.`,
      hint: `Name the integration too, for example kaneo workflow delete ${match.rules[0]?.integration ?? "github"} ${match.rules[0]?.event ?? ""}.`,
    });
  }
  const wanted = [first.value, ...Option.toArray(second)].join(" ").trim();
  return yield* new InvalidArgument({
    message: `No workflow rule matches "${wanted}" in ${projectName}.`,
    hint: "Run kaneo workflow list to see the rules.",
  });
});

export const runWorkflowDelete = Effect.fn("command.workflow.delete")(
  function* (options: {
    readonly rule: Option.Option<string>;
    readonly event: Option.Option<string>;
    readonly project: Option.Option<string>;
    readonly yes: boolean;
  }) {
    const workspaceId = yield* resolveWorkspaceId();
    const project = yield* resolveProject(workspaceId, options.project);
    const rules = sortRules(
      (yield* withSpinner("Loading workflow rules")(
        listWorkflowRules(project.id),
      )).map(toRuleJson),
    );
    const rule = yield* findRule(
      rules,
      options.rule,
      options.event,
      project.name,
    );

    yield* confirmDestructive({
      yes: options.yes,
      action: `Deleting the rule ${ruleName(rule)}`,
      question: `Delete the rule ${ruleName(rule)} in ${project.name}? Tasks then move to the integration's default column.`,
    });

    yield* withSpinner("Deleting the rule")(deleteWorkflowRule(rule.id));
    yield* emit({ ...rule, deleted: true }, (ui) =>
      renderRuleChange(ui, { verb: "Deleted", rule }),
    );
  },
);

export const workflowDelete = Command.make(
  "delete",
  {
    rule: Argument.String("rule").pipe(
      Argument.withDescription(
        "Integration (github, gitlab, gitea) followed by the event, an event alone, or a rule id",
      ),
      Argument.optional,
    ),
    event: Argument.String("event").pipe(
      Argument.withDescription(
        "Event, when the first argument is the integration",
      ),
      Argument.optional,
    ),
    project: Flag.String("project").pipe(
      Flag.withAlias("p"),
      Flag.withDescription("Project key or id, for example KAN"),
      Flag.optional,
    ),
    yes: Flag.Boolean("yes").pipe(
      Flag.withAlias("y"),
      Flag.withDescription("Delete without asking for confirmation"),
      Flag.withDefault(false),
    ),
  },
  (options) => runWorkflowDelete(options),
).pipe(
  Command.withDescription("Delete a workflow rule"),
  Command.provide(ApiLayer),
);
