import { Effect, Option, Result } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { type ImportOutcome, importTasks } from "../../api/export-import.js";
import { listColumns } from "../../api/endpoints.js";
import { describeError } from "../../errors/describe.js";
import { emit, note } from "../../output/emit.js";
import { Output } from "../../output/output.js";
import { withSpinner } from "../../output/spinner.js";
import { confirmDestructive } from "../../prompts/confirm-destructive.js";
import {
  resolveProject,
  resolveWorkspaceId,
} from "../../services/selection.js";
import { Session } from "../../services/session.js";
import { batches } from "../../transfer/batches.js";
import { planImport } from "../../transfer/import-plan.js";
import { buildImportReport } from "../../transfer/import-report.js";
import { parseImportDocument } from "../../transfer/parse-import-file.js";
import { readImportSource } from "../../transfer/read-import-source.js";
import {
  renderImportReport,
  renderImportWarnings,
} from "../../transfer/render-import-report.js";
import { ApiLayer } from "../api-layer.js";

const BATCH_SIZE = 50;

function tasks(count: number): string {
  return count === 1 ? "1 task" : `${count} tasks`;
}

export const runTaskImport = Effect.fn("command.task.import")(
  function* (options: {
    readonly file: string;
    readonly project: Option.Option<string>;
    readonly dryRun: boolean;
    readonly yes: boolean;
  }) {
    const session = yield* Session;
    const output = yield* Output;
    const content = yield* readImportSource(options.file);
    const candidates = yield* Effect.fromResult(
      parseImportDocument(
        content,
        options.file === "-" ? "stdin" : options.file,
      ),
    );
    const workspaceId = yield* resolveWorkspaceId();
    const project = yield* resolveProject(workspaceId, options.project);
    const columns = yield* withSpinner(`Loading ${project.name}`)(
      listColumns(project.id),
    );
    const plan = planImport(candidates, columns);
    const report = (outcomes: ReadonlyArray<ImportOutcome> | null) =>
      buildImportReport({
        project,
        columns,
        webUrl: session.webUrl,
        plan,
        outcomes,
      });

    if (options.dryRun) {
      return yield* emit(report(null), renderImportReport);
    }

    const preview = report(null);
    if (
      output.mode === "human" &&
      renderImportWarnings(output.errUi, preview).length > 0
    ) {
      yield* note((ui) => ["", ...renderImportWarnings(ui, preview), ""]);
    }
    const count = tasks(plan.tasks.length);
    yield* confirmDestructive({
      yes: options.yes,
      action: `Importing ${count} into ${project.name}`,
      question: `Import ${count} into ${project.name}? Running the import again creates them again.`,
    });

    const outcomes: ImportOutcome[] = [];
    for (const batch of batches(plan.tasks, BATCH_SIZE)) {
      const done = outcomes.length;
      const label =
        plan.tasks.length > BATCH_SIZE
          ? `Importing ${done + 1} to ${done + batch.length} of ${plan.tasks.length}`
          : `Importing ${count}`;
      const result = yield* withSpinner(label)(
        importTasks(project.id, batch),
      ).pipe(Effect.result);
      if (Result.isFailure(result)) {
        if (done === 0) return yield* Effect.fail(result.failure);
        const error = `Not imported: ${describeError(result.failure).message}`;
        outcomes.push(
          ...plan.tasks.slice(done).map((task): ImportOutcome => ({
            success: false,
            error,
            task: { title: task.title },
          })),
        );
        break;
      }
      outcomes.push(...result.success.results.tasks);
    }

    const final = report(outcomes);
    yield* emit(final, renderImportReport);
    if (final.failed > 0 || final.imported < final.total) {
      yield* Effect.sync(() => {
        process.exitCode = 1;
      });
    }
  },
);

export const taskImport = Command.make(
  "import",
  {
    file: Argument.String("file").pipe(
      Argument.withDescription(
        "JSON file from kaneo task export (or a list of tasks), or - for stdin",
      ),
    ),
    project: Flag.String("project").pipe(
      Flag.withAlias("p"),
      Flag.withDescription("Project to import into, for example KAN"),
      Flag.optional,
    ),
    dryRun: Flag.Boolean("dry-run").pipe(
      Flag.withDescription("Check the file and show what would be imported"),
      Flag.withDefault(false),
    ),
    yes: Flag.Boolean("yes").pipe(
      Flag.withAlias("y"),
      Flag.withDescription("Import without asking for confirmation"),
      Flag.withDefault(false),
    ),
  },
  (options) => runTaskImport(options),
).pipe(
  Command.withDescription(
    "Create tasks in a project from a JSON file; labels are not imported",
  ),
  Command.provide(ApiLayer),
);
