import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import {
  listCustomFields,
  listTaskFieldValues,
  setTaskFieldValue,
} from "../../api/custom-fields.js";
import { InvalidArgument } from "../../errors/errors.js";
import { unknownField } from "../../fields/choose-field.js";
import { toFieldJson } from "../../fields/field-json.js";
import {
  fieldValueJson,
  formatJsonValue,
  parseFieldValue,
} from "../../fields/field-value.js";
import { matchField } from "../../fields/match-field.js";
import { renderFieldValueChange } from "../../fields/render-field-change.js";
import {
  renderTaskFields,
  type TaskFieldJson,
} from "../../fields/render-task-fields.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { resolveTask } from "../../tasks/resolve-task.js";
import { ApiLayer } from "../api-layer.js";

export const runTaskField = Effect.fn("command.task.field")(
  function* (options: {
    readonly task: string;
    readonly field: Option.Option<string>;
    readonly value: Option.Option<string>;
    readonly clear: boolean;
  }) {
    if (options.clear && Option.isSome(options.value)) {
      return yield* new InvalidArgument({
        message: "Pass a value or --clear, not both.",
      });
    }
    if (options.clear && Option.isNone(options.field)) {
      return yield* new InvalidArgument({
        message: "Which field should be cleared?",
        hint: 'Pass the field name, for example kaneo task field KAN-12 "Story points" --clear.',
      });
    }
    const resolved = yield* withSpinner(`Loading ${options.task}`)(
      resolveTask(options.task),
    );
    const label = resolved.ticketId ?? resolved.task.id.slice(0, 8);
    const [definitions, values] = yield* withSpinner("Loading fields")(
      Effect.all(
        [
          listCustomFields(resolved.task.projectId),
          listTaskFieldValues(resolved.task.id),
        ],
        { concurrency: 2 },
      ),
    );
    const fields = definitions.map(toFieldJson);
    const valueOf = (fieldId: string) =>
      values.find((value) => value.fieldId === fieldId)?.value ?? null;
    const taskJson = {
      id: resolved.task.id,
      ticketId: resolved.ticketId,
      url: resolved.url,
    };

    const field = Option.isSome(options.field)
      ? matchField(fields, options.field.value)
      : undefined;
    if (Option.isSome(options.field) && !field) {
      return yield* unknownField(
        fields,
        options.field.value,
        resolved.project.name,
      );
    }

    if (!field || (Option.isNone(options.value) && !options.clear)) {
      const shown: TaskFieldJson[] = (field ? [field] : fields).map(
        (entry) => ({
          id: entry.id,
          name: entry.name,
          type: entry.type,
          value: fieldValueJson(entry.type, valueOf(entry.id)),
        }),
      );
      yield* emit({ ...taskJson, fields: shown }, (ui, view) =>
        renderTaskFields(ui, {
          label,
          title: resolved.task.title,
          url: resolved.url,
          fields: view.fields,
        }),
      );
      return;
    }

    if (options.clear && field.required) {
      return yield* new InvalidArgument({
        message: `${field.name} is required, so it cannot be cleared.`,
        hint: "Set another value instead.",
      });
    }
    const raw = Option.isSome(options.value)
      ? yield* Effect.fromResult(
          parseFieldValue(field, options.value.value, new Date()),
        )
      : "";
    yield* withSpinner(`Updating ${label}`)(
      setTaskFieldValue({
        taskId: resolved.task.id,
        fieldId: field.id,
        value: raw,
      }),
    );
    const value = fieldValueJson(field.type, raw);
    yield* emit(
      {
        ...taskJson,
        field: { id: field.id, name: field.name, type: field.type },
        value,
      },
      (ui) =>
        renderFieldValueChange(ui, {
          label,
          url: resolved.url,
          field: field.name,
          value: formatJsonValue(value),
        }),
    );
  },
);

export const taskField = Command.make(
  "field",
  {
    task: Argument.String("task").pipe(
      Argument.withDescription("Ticket id such as KAN-12, or the task id"),
    ),
    field: Argument.String("field").pipe(
      Argument.withDescription(
        "Custom field name or id; leave out to show every field",
      ),
      Argument.optional,
    ),
    value: Argument.String("value").pipe(
      Argument.withDescription(
        "New value: text, a number, a date (YYYY-MM-DD, today, +3d), yes or no, an option, or comma-separated options",
      ),
      Argument.optional,
    ),
    clear: Flag.Boolean("clear").pipe(
      Flag.withDescription("Remove the field's value from the task"),
      Flag.withDefault(false),
    ),
  },
  (options) => runTaskField(options),
).pipe(
  Command.withDescription("Show or set the custom field values of a task"),
  Command.provide(ApiLayer),
);
