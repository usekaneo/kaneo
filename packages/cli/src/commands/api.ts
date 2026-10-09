import { Effect, Option, Result, Schema } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { type HttpMethod, KaneoApi } from "../api/kaneo-api.js";
import { InvalidArgument } from "../errors/errors.js";
import { readTextInput } from "../input/read-text-input.js";
import { emit } from "../output/emit.js";
import { withSpinner } from "../output/spinner.js";
import { normalizeApiPath } from "../passthrough/normalize-api-path.js";
import { parseFields, parseQuery } from "../passthrough/parse-fields.js";
import { renderJson } from "../passthrough/render-json.js";
import { ApiLayer } from "./api-layer.js";

const METHODS: ReadonlyArray<HttpMethod> = [
  "GET",
  "POST",
  "PUT",
  "PATCH",
  "DELETE",
];

function toMethod(value: string): HttpMethod | undefined {
  const upper = value.toUpperCase();
  return METHODS.find((method) => method === upper);
}

const readBody = Effect.fn("api.body")(function* (
  fields: ReadonlyArray<string>,
  input: Option.Option<string>,
) {
  if (fields.length > 0 && Option.isSome(input)) {
    return yield* new InvalidArgument({
      message: "Pass either -f fields or --input, not both.",
    });
  }
  if (fields.length > 0) {
    const parsed = parseFields(fields);
    if (Result.isFailure(parsed)) return yield* parsed.failure;
    return parsed.success as unknown;
  }
  if (Option.isNone(input)) return undefined;
  const text = yield* readTextInput(
    input.value === "-"
      ? { value: input, file: Option.none(), flag: "--input" }
      : { value: Option.none(), file: input, flag: "--input" },
  );
  const raw = Option.getOrElse(text, () => "");
  if (raw.trim() === "") return undefined;
  return yield* Effect.try({
    try: () => JSON.parse(raw) as unknown,
    catch: () =>
      new InvalidArgument({
        message: `The --input body is not valid JSON.`,
        hint: "Pass a JSON document, or build the body with -f key=value.",
      }),
  });
});

export const runApi = Effect.fn("command.api")(function* (options: {
  readonly method: string;
  readonly path: string;
  readonly fields: ReadonlyArray<string>;
  readonly input: Option.Option<string>;
  readonly query: ReadonlyArray<string>;
}) {
  const method = toMethod(options.method);
  if (!method) {
    return yield* new InvalidArgument({
      message: `${options.method} is not a supported HTTP method.`,
      hint: `Use one of ${METHODS.join(", ")}, for example kaneo api GET /user/me.`,
    });
  }
  const target = normalizeApiPath(options.path);
  if (Result.isFailure(target)) return yield* target.failure;
  const query = parseQuery(options.query);
  if (Result.isFailure(query)) return yield* query.failure;
  const body = yield* readBody(options.fields, options.input);
  if (method === "GET" && body !== undefined) {
    return yield* new InvalidArgument({
      message: "GET requests cannot have a body.",
      hint: "Pass query parameters with --query key=value instead.",
    });
  }

  const api = yield* KaneoApi;
  const response = yield* withSpinner(`${method} ${target.success.path}`)(
    api.request(method, target.success.path, Schema.Unknown, {
      raw: true,
      query: { ...target.success.query, ...query.success },
      body,
    }),
  );
  yield* emit(response, renderJson);
});

export const apiCommand = Command.make(
  "api",
  {
    method: Argument.String("method").pipe(
      Argument.withDescription("HTTP method: GET, POST, PUT, PATCH or DELETE"),
    ),
    path: Argument.String("path").pipe(
      Argument.withDescription(
        "Path under /api, for example /task/assigned (the /api prefix is optional)",
      ),
    ),
    fields: Flag.String("field").pipe(
      Flag.withAlias("f"),
      Flag.withDescription(
        "Add key=value to the JSON body; values that parse as JSON keep their type, a.b=1 nests (repeatable)",
      ),
      Flag.atLeast(0),
    ),
    input: Flag.String("input").pipe(
      Flag.withDescription("Read the JSON body from a file, or - for stdin"),
      Flag.optional,
    ),
    query: Flag.String("query").pipe(
      Flag.withDescription("Add a key=value query parameter (repeatable)"),
      Flag.atLeast(0),
    ),
  },
  (options) => runApi(options),
).pipe(
  Command.withDescription("Send an authenticated request to the Kaneo API"),
  Command.provide(ApiLayer),
);
