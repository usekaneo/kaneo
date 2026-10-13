import { Effect, Option } from "effect";
import { InvalidArgument } from "../errors/errors.js";
import { Output } from "../output/output.js";
import { pick } from "../prompts/pick.js";
import type { FieldJson } from "./field-json.js";
import { fieldTypeLabel } from "./field-types.js";
import { matchField } from "./match-field.js";

export function unknownField(
  fields: ReadonlyArray<FieldJson>,
  reference: string,
  projectName: string,
): InvalidArgument {
  return new InvalidArgument({
    message: `No custom field matches "${reference}" in ${projectName}.`,
    hint:
      fields.length > 0
        ? `Fields: ${fields.map((field) => field.name).join(", ")}.`
        : "This project has no custom fields. Add one with kaneo field create.",
  });
}

export const chooseField = Effect.fnUntraced(function* (
  fields: ReadonlyArray<FieldJson>,
  reference: Option.Option<string>,
  options: {
    readonly projectName: string;
    readonly question: string;
    readonly example: string;
  },
) {
  const output = yield* Output;
  if (Option.isSome(reference)) {
    const match = matchField(fields, reference.value);
    if (match) return match;
    return yield* unknownField(fields, reference.value, options.projectName);
  }
  if (output.interactive && fields.length > 0) {
    return yield* pick(
      options.question,
      fields.map((field) => ({
        title: field.name,
        value: field,
        description: fieldTypeLabel(field.type),
      })),
    );
  }
  if (fields.length === 0) {
    return yield* new InvalidArgument({
      message: `${options.projectName} has no custom fields.`,
      hint: "Add one with kaneo field create <name> --type text.",
    });
  }
  return yield* new InvalidArgument({
    message: "Which field?",
    hint: `Pass its name or id, for example ${options.example}.`,
  });
});
