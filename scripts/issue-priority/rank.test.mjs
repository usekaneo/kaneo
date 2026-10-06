import assert from "node:assert/strict";
import { test } from "node:test";
import { rankAndLabel } from "./rank.mjs";

const event = { action: "opened", issue: { number: 42 } };
const env = {
  GITHUB_REPOSITORY: "usekaneo/kaneo",
  GH_TOKEN: "github-test-token",
  OPENROUTER_API_KEY: "openrouter-test-key",
};

function response(body, status = 200) {
  return { ok: status < 400, status, json: async () => body };
}

test("Jev ranks issue content and adds the matching existing label", async () => {
  const calls = [];
  const title = "Broken board $(touch /tmp/should-not-run)";
  const fetcher = async (url, options) => {
    calls.push({ url, options });
    if (calls.length === 1) {
      return response({
        state: "open",
        title,
        body: "Tasks disappear after refresh.",
        labels: [{ name: "bug" }],
      });
    }
    if (calls.length === 2) {
      return response({
        answers: { priority: { type: "choice", choice: "high" } },
      });
    }
    if (calls.length === 3) {
      return response({ state: "open", labels: [{ name: "bug" }] });
    }
    return response([{ name: "bug" }, { name: "priority:high" }]);
  };

  assert.equal(await rankAndLabel(event, env, fetcher), "high");
  assert.equal(calls.length, 4);
  assert.equal(calls[1].url, "https://openrouter.ai/api/alpha/decisions");
  assert.equal(
    calls[1].options.headers.Authorization,
    "Bearer openrouter-test-key",
  );
  const decision = JSON.parse(calls[1].options.body);
  assert.equal(decision.model, "typesafe/jev-1.13");
  assert.equal(decision.state.title, title);
  assert.deepEqual(decision.state.labels, ["bug"]);
  assert.deepEqual(Object.keys(decision.questions.priority.criteria), [
    "urgent",
    "high",
    "medium",
    "low",
  ]);
  assert.equal(calls[3].url.endsWith("/issues/42/labels"), true);
  assert.deepEqual(JSON.parse(calls[3].options.body), {
    labels: ["priority:high"],
  });
});

test("an existing priority keeps human triage and skips Jev", async () => {
  let requests = 0;
  const fetcher = async () => {
    requests++;
    return response({
      state: "open",
      labels: [{ name: "priority:urgent" }],
    });
  };
  assert.equal(await rankAndLabel(event, env, fetcher), null);
  assert.equal(requests, 1);
});

test("an unknown Jev answer never writes a label", async () => {
  let requests = 0;
  const fetcher = async () => {
    requests++;
    return requests === 1
      ? response({ state: "open", title: "Example", body: "", labels: [] })
      : response({
          answers: { priority: { type: "choice", choice: "critical" } },
        });
  };
  await assert.rejects(rankAndLabel(event, env, fetcher), /invalid priority/);
  assert.equal(requests, 2);
});

test("a priority added during ranking wins over Jev", async () => {
  let requests = 0;
  const fetcher = async () => {
    requests++;
    if (requests === 1)
      return response({
        state: "open",
        title: "Example",
        body: "",
        labels: [],
      });
    if (requests === 2)
      return response({
        answers: { priority: { type: "choice", choice: "low" } },
      });
    return response({ state: "open", labels: [{ name: "priority:high" }] });
  };
  assert.equal(await rankAndLabel(event, env, fetcher), null);
  assert.equal(requests, 3);
});
