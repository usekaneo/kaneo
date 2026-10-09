import { Effect } from "effect";

export type JqFilter = {
  readonly expression: string;
  readonly run: (
    input: unknown,
  ) => Effect.Effect<ReadonlyArray<unknown>, string>;
};

const LIMITS = {
  maxSteps: Number.MAX_SAFE_INTEGER,
  maxDepth: 1000,
  maxOutputs: Number.MAX_SAFE_INTEGER,
};

export function describeJqError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const start = (error as { span?: { start?: unknown } }).span?.start;
  return typeof start === "number" &&
    (error.name === "ParseError" || error.name === "LexError")
    ? `${error.message} at column ${start + 1}`
    : error.message;
}

export const compileJq = Effect.fnUntraced(function* (expression: string) {
  const jq = yield* Effect.tryPromise({
    try: () => import("@gabrielbryk/jq-ts"),
    catch: (error) =>
      `could not load the jq engine (${describeJqError(error)})`,
  });
  const ast = yield* Effect.try({
    try: () => {
      const parsed = jq.parse(expression);
      jq.validate(parsed);
      return parsed;
    },
    catch: describeJqError,
  });
  const filter: JqFilter = {
    expression,
    run: (input) =>
      Effect.try({
        try: () =>
          jq.runAst(ast, input as Parameters<typeof jq.runAst>[1], {
            limits: LIMITS,
            now: new Date(),
          }),
        catch: describeJqError,
      }),
  };
  return filter;
});
