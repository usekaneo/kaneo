import assert from "node:assert/strict";
import test from "node:test";
import { cliOptions, readKey } from "../cli.mjs";
import {
  completion,
  localPath,
  prNumber,
  samplePlan,
  validatePlan,
} from "../core.mjs";
import { fixture, installFixtures } from "../fixtures.mjs";

test("key-file parsing handles quotes and comments without evaluating shell expressions", () => {
  assert.equal(
    readKey('API_KEY="example-token-for-testing" # comment'),
    "example-token-for-testing",
  );
  assert.equal(
    readKey("export OPENROUTER_API_KEY=example-token-for-testing # comment"),
    "example-token-for-testing",
  );
  assert.throws(() => readKey("API_KEY="));
  assert.equal(
    readKey("API_KEY='$(do-not-execute-this)'"),
    "$(do-not-execute-this)",
  );
});

test("only Kaneo PRs and local application routes are accepted", () => {
  assert.equal(prNumber("https://github.com/usekaneo/kaneo/pull/1719"), 1719);
  for (const input of [
    "1;echo token",
    "https://github.com/other/repo/pull/1",
    "-1",
  ])
    assert.throws(() => prNumber(input));
  for (const input of [
    "//evil.example",
    "/\\evil.example",
    "https://evil.example",
    "/api/auth/change-password",
    "/x/../api/auth",
  ])
    assert.throws(() => localPath(input));
  assert.equal(
    localPath("/dashboard/settings?tab=account"),
    "/dashboard/settings?tab=account",
  );
});

test("AI plans cannot execute code and remain bounded", () => {
  const sample = samplePlan();
  assert.equal(sample.scenarios.length, 3);
  assert.throws(() =>
    validatePlan({
      scenarios: [
        {
          beforePath: "/",
          afterPath: "/",
          actions: [{ type: "evaluate", by: "text", name: "x" }],
        },
      ],
    }),
  );
  assert.throws(() =>
    validatePlan({
      scenarios: [
        {
          beforePath: "/",
          afterPath: "/",
          actions: [{ type: "click", by: "css", name: "body" }],
        },
      ],
    }),
  );
  assert.equal(
    validatePlan({ scenarios: Array(10).fill(sample.scenarios[0]) }).scenarios
      .length,
    3,
  );
});

test("synthetic account fixtures are stable and do not invent unknown endpoints", () => {
  const session = fixture("http://local/api/auth/get-session", "GET");
  assert.equal(session.user.email, "alex@example.test");
  assert.equal(
    fixture("http://local/api/auth/list-accounts", "GET")[0].providerId,
    "credential",
  );
  assert.equal(fixture("http://local/api/unknown", "GET"), undefined);
});

test("browser requests cannot leak to external endpoints or mutate a real API", async () => {
  let intercept;
  const context = {
    addInitScript: async () => {},
    route: async (_, fn) => {
      intercept = fn;
    },
    routeWebSocket: async () => {},
  };
  const diagnostics = { unhandled: [], blocked: [] };
  await installFixtures(context, "http://127.0.0.1:1234", diagnostics);
  async function request(url, method = "GET") {
    let result;
    await intercept({
      request: () => ({ url: () => url, method: () => method }),
      abort: () => {
        result = "blocked";
      },
      continue: () => {
        result = "continue";
      },
      fulfill: (x) => {
        result = x;
      },
    });
    return result;
  }
  assert.equal(await request("https://example.com/tracker"), "blocked");
  assert.equal(await request("http://127.0.0.1:1234/src/main.tsx"), "continue");
  assert.equal(
    (await request("http://127.0.0.1:4799/api/auth/change-password", "POST"))
      .status,
    200,
  );
  assert.equal(
    (await request("http://127.0.0.1:4799/api/unknown")).status,
    501,
  );
});

test("provider errors never echo a request or credential", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 401,
    json: async () => ({
      error: { code: 401, message: "secret-key-in-error" },
    }),
  });
  try {
    await assert.rejects(
      completion({
        token: "secret-key-in-error",
        model: "test",
        messages: [],
        run: { calls: 0 },
        signal: new AbortController().signal,
      }),
      (error) =>
        !error.message.includes("secret-key-in-error") &&
        error.message.includes("401"),
    );
  } finally {
    globalThis.fetch = original;
  }
});

test("OpenRouter request uses valid headers and records returned usage", async () => {
  const original = globalThis.fetch;
  const run = {
    calls: 0,
    usage: { input: 0, output: 0, cost: 0, costKnown: true },
  };
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
    const headers = new Headers(options.headers);
    assert.equal(headers.get("Authorization"), "Bearer test-key");
    assert.equal(JSON.parse(options.body).model, "test/model");
    return {
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"summary":"done"}' } }],
        usage: { prompt_tokens: 100, completion_tokens: 20, cost: 0.001 },
      }),
    };
  };
  try {
    assert.deepEqual(
      await completion({
        token: "test-key",
        model: "test/model",
        messages: [],
        run,
        signal: new AbortController().signal,
      }),
      { summary: "done" },
    );
    assert.deepEqual(run.usage, {
      input: 100,
      output: 20,
      cost: 0.001,
      costKnown: true,
    });
  } finally {
    globalThis.fetch = original;
  }
});

test("CLI requires an explicit PR and rejects misspelled flags before spending or posting", () => {
  assert.throws(() => cliOptions([]), /exactly one/);
  assert.throws(() => cliOptions(["1719", "1720"]), /exactly one/);
  assert.throws(() => cliOptions(["1719", "--no-pots"]));
  assert.throws(() => cliOptions(["1719", "--model"]));
  const options = cliOptions(["1719", "--no-post", "--capture-only"]);
  assert.equal(options.number, 1719);
  assert.equal(options.post, false);
  assert.equal(options.mode, "capture");
});

test("temporary provider throttling retries within the five-request budget", async () => {
  const original = globalThis.fetch;
  const run = {
    calls: 0,
    usage: { input: 0, output: 0, cost: 0, costKnown: true },
  };
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return calls === 1
      ? new Response('{"error":{"code":429}}', {
          status: 429,
          headers: { "retry-after": "0" },
        })
      : Response.json({
          choices: [{ message: { content: '{"caption":"Captured"}' } }],
          usage: { cost: 0 },
        });
  };
  try {
    const args = {
      token: "test",
      model: "test",
      messages: [],
      run,
      signal: new AbortController().signal,
    };
    assert.deepEqual(await completion(args), { caption: "Captured" });
    assert.equal(run.calls, 2);
    globalThis.fetch = async () =>
      new Response('{"error":{"code":429}}', {
        status: 429,
        headers: { "retry-after": "0" },
      });
    run.calls = 4;
    await assert.rejects(completion(args), /429/);
    assert.equal(run.calls, 5);
    await assert.rejects(completion(args), /five-call limit/);
    assert.equal(run.calls, 5);
  } finally {
    globalThis.fetch = original;
  }
});

test("default provider outage switches to a vision fallback and keeps it for the run", async () => {
  const original = globalThis.fetch;
  const requests = [];
  const run = {
    calls: 0,
    reasoning: { max_tokens: 512 },
    usage: { input: 0, output: 0, cost: 0, costKnown: true },
  };
  globalThis.fetch = async (_, options) => {
    const body = JSON.parse(options.body);
    requests.push(body);
    return body.model === "qwen/qwen3.8-flash"
      ? new Response('{"error":{"code":429}}', {
          status: 429,
          headers: { "retry-after": "0" },
        })
      : Response.json({
          choices: [{ message: { content: '{"caption":"Captured"}' } }],
          usage: { cost: 0 },
        });
  };
  try {
    const args = {
      token: "test",
      model: "qwen/qwen3.8-flash",
      messages: [],
      run,
      signal: new AbortController().signal,
    };
    await completion(args);
    await completion(args);
    assert.equal(run.calls, 3);
    assert.deepEqual(
      requests.map((x) => x.model),
      [
        "qwen/qwen3.8-flash",
        "google/gemini-2.5-flash-lite",
        "google/gemini-2.5-flash-lite",
      ],
    );
    assert.equal(requests[1].reasoning, undefined);
    assert.deepEqual(run.modelsUsed, ["google/gemini-2.5-flash-lite"]);
  } finally {
    globalThis.fetch = original;
  }
});

test("framing accepts only bounded semantic targets, never selectors or executable code", () => {
  const scenario = samplePlan().scenarios[0];
  for (const focus of [
    { by: "css", name: "body" },
    { by: "text", name: "" },
    { by: "text", name: "x".repeat(201) },
  ])
    assert.throws(
      () => validatePlan({ scenarios: [{ ...scenario, focus }] }),
      /Invalid screenshot target/,
    );
  const plan = validatePlan({
    scenarios: [
      {
        ...scenario,
        focus: { by: "role", role: "heading", name: "Account" },
        visible: [{ by: "label", name: "Email" }],
      },
    ],
  });
  assert.equal(plan.scenarios[0].focus.role, "heading");
  assert.equal(plan.scenarios[0].visible[0].name, "Email");
});
