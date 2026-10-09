import { Effect, Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { applyJq } from "./apply-jq.js";
import { compileJq } from "./compile-jq.js";

const tasks = [
  { ticketId: "KAN-1", title: "Fix login", status: "done", due: undefined },
  { ticketId: "KAN-2", title: "Ship", status: "todo" },
];

async function jq(expression: string, input: unknown) {
  const filter = await Effect.runPromise(compileJq(expression));
  return Effect.runPromise(applyJq(filter, input));
}

describe("compileJq", () => {
  it("supports paths, pipes, select, map, has, length, keys and objects", async () => {
    expect(await jq(".[0].title", tasks)).toBe("Fix login\n");
    expect(await jq('.[] | select(.status == "todo") | .ticketId', tasks)).toBe(
      "KAN-2\n",
    );
    expect(await jq("map(.ticketId)", tasks)).toBe('["KAN-1","KAN-2"]\n');
    expect(await jq('map(has("due"))', tasks)).toBe("[false,false]\n");
    expect(await jq("length", tasks)).toBe("2\n");
    expect(await jq(".[1] | keys", tasks)).toBe(
      '["status","ticketId","title"]\n',
    );
    expect(await jq(".[] | {id: .ticketId}", tasks)).toBe(
      '{"id":"KAN-1"}\n{"id":"KAN-2"}\n',
    );
    expect(await jq('.[] | "\\(.ticketId): \\(.title)"', tasks)).toBe(
      "KAN-1: Fix login\nKAN-2: Ship\n",
    );
  });

  it("rejects a bad expression with its position", async () => {
    const result = await Effect.runPromise(Effect.result(compileJq(".[")));
    expect(Result.isFailure(result) && result.failure).toBe(
      "Unexpected token at column 3",
    );
  });

  it("reports runtime errors as invalid arguments", async () => {
    const filter = await Effect.runPromise(compileJq(".[0]"));
    const result = await Effect.runPromise(
      Effect.result(applyJq(filter, { a: 1 })),
    );
    expect(Result.isFailure(result) && result.failure.message).toBe(
      "The --jq expression failed: Cannot index object with number",
    );
  });
});
