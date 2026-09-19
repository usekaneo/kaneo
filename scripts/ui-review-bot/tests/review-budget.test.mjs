import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { MODEL } from "../code-review/limits.mjs";
import { responseFormat } from "../code-review/schema.mjs";
import { reviewModel } from "../worker/review-model.mjs";

async function setup(t, ceiling = 850000) {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  db.exec(
    await readFile(new URL("../worker/schema.sql", import.meta.url), "utf8"),
  );
  db.prepare(
    "INSERT INTO review_budget (id, ceiling, initial_spend) VALUES (1, ?, 100000)",
  ).run(ceiling);
  const wrap = (sql, args = []) => ({
    bind: (...values) => wrap(sql, values),
    first: async () => db.prepare(sql).get(...args) || null,
    run: async () => ({
      meta: { changes: db.prepare(sql).run(...args).changes },
    }),
  });
  return {
    db,
    env: {
      REVIEW_PROXY_TOKEN: "a".repeat(64),
      OPENROUTER_API_KEY: "test-key",
      DB: {
        prepare: (sql) => wrap(sql),
        batch: async (items) => {
          db.exec("BEGIN");
          try {
            const r = [];
            for (const item of items) r.push(await item.run());
            db.exec("COMMIT");
            return r;
          } catch (e) {
            db.exec("ROLLBACK");
            throw e;
          }
        },
      },
    },
  };
}

function request(
  text = "review",
  token = "a".repeat(64),
  attempt = "11111111-1111-4111-8111-111111111111",
) {
  return new Request("https://example.test/review-model", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "X-Peekareview-Attempt": attempt,
    },
    body: JSON.stringify({
      model: MODEL,
      response_format: responseFormat("investigate"),
      messages: [
        { role: "system", content: "review source" },
        { role: "user", content: text },
      ],
    }),
  });
}
const reply = (cost = 0.001) =>
  Response.json({
    model: MODEL,
    choices: [
      {
        finish_reason: "stop",
        message: { content: '{"findings":[],"requests":[]}' },
      },
    ],
    usage: { cost },
  });

test("shared SQL ledger reserves before inference and concurrent identical requests bill once", async (t) => {
  const { db, env } = await setup(t);
  let calls = 0;
  const provider = async (_url, options) => {
    calls++;
    assert.equal(options.redirect, "manual");
    assert.equal(
      db.prepare("SELECT status FROM review_requests").get().status,
      "reserved",
    );
    const body = JSON.parse(options.body);
    assert.equal(body.provider.max_price.completion, 0.6);
    assert.equal(body.max_tokens, 8192);
    return reply();
  };
  const results = await Promise.all([
    reviewModel(request(), env, provider),
    reviewModel(request(), env, provider),
  ]);
  assert.equal(calls, 1);
  assert.ok(results.some((r) => r.status === 200));
  assert.equal(
    db.prepare("SELECT charged FROM review_requests").get().charged,
    1150,
  );
  const cached = await reviewModel(request(), env, provider);
  assert.equal((await cached.json()).usage.cost, 0);
  assert.equal(calls, 1);
});

test("missing initialization, exhausted budget and bad authorization send no paid request", async (t) => {
  const { db, env } = await setup(t, 100000);
  const provider = () => {
    throw new Error("Provider must not run");
  };
  assert.equal((await reviewModel(request(), env, provider)).status, 429);
  assert.equal(
    (await reviewModel(request("x", "b".repeat(64)), env, provider)).status,
    401,
  );
  db.exec("DELETE FROM review_budget");
  assert.equal((await reviewModel(request(), env, provider)).status, 429);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS n FROM review_requests").get().n,
    0,
  );
});

test("timeouts retain reservations; replays do not silently retry", async (t) => {
  const { db, env } = await setup(t);
  let calls = 0;
  const provider = async () => {
    calls++;
    throw new Error("timeout");
  };
  assert.equal((await reviewModel(request(), env, provider)).status, 502);
  assert.equal((await reviewModel(request(), env, provider)).status, 409);
  const row = db
    .prepare("SELECT reserved, charged, status FROM review_requests")
    .get();
  assert.equal(row.status, "reserved");
  assert.equal(row.charged, row.reserved);
  assert.equal(calls, 1);
});

test("unknown costs remain reserved and provider overspend halts later requests", async (t) => {
  const { db, env } = await setup(t);
  assert.equal(
    (await reviewModel(request("unknown"), env, async () => reply(null)))
      .status,
    502,
  );
  assert.equal(
    db.prepare("SELECT status FROM review_requests").get().status,
    "reserved",
  );
  assert.equal(
    (await reviewModel(request("over"), env, async () => reply(0.2))).status,
    502,
  );
  assert.equal(db.prepare("SELECT halted FROM review_budget").get().halted, 1);
  assert.equal(
    (
      await reviewModel(request("later"), env, async () => {
        throw new Error("Must not call");
      })
    ).status,
    429,
  );
});

test("proxy rejects unknown stages and replaces client schemas with trusted definitions", async (t) => {
  const { env } = await setup(t);
  const body = await request().json();
  const make = (input) =>
    new Request("https://example.test/review-model", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${"a".repeat(64)}`,
        "X-Peekareview-Attempt": "11111111-1111-4111-8111-111111111111",
      },
      body: JSON.stringify(input),
    });
  body.response_format.json_schema.name = "arbitrary";
  assert.equal(
    (
      await reviewModel(make(body), env, () => {
        throw Error("Must not call");
      })
    ).status,
    400,
  );
  body.response_format.json_schema.name = "verify";
  body.response_format.json_schema.schema = { type: "string" };
  assert.equal(
    (
      await reviewModel(make(body), env, async (_url, options) => {
        assert.deepEqual(
          JSON.parse(options.body).response_format,
          responseFormat("verify"),
        );
        return reply();
      })
    ).status,
    200,
  );
});

test("schema-invalid replies are charged but cannot replay as successful cached reviews", async (t) => {
  const { db, env } = await setup(t);
  let calls = 0;
  const provider = async () => {
    calls++;
    return Response.json({
      model: MODEL,
      usage: { cost: 0.001 },
      choices: [
        { finish_reason: "stop", message: { content: '{"findngs":[]}' } },
      ],
    });
  };
  assert.equal((await reviewModel(request(), env, provider)).status, 200);
  assert.equal(
    db.prepare("SELECT status FROM review_requests").get().status,
    "failed",
  );
  assert.equal((await reviewModel(request(), env, provider)).status, 409);
  assert.equal(calls, 1);
});

test("a new review can retry an unresolved request while retaining its earlier reservation", async (t) => {
  const { db, env } = await setup(t);
  const first = await reviewModel(request(), env, async () => {
    throw Error("timeout");
  });
  assert.equal(first.status, 502);
  const reserved = db
    .prepare("SELECT charged FROM review_requests")
    .get().charged;
  assert.equal(
    (
      await reviewModel(request(), env, async () => {
        throw Error("No automatic replay");
      })
    ).status,
    409,
  );
  const second = await reviewModel(
    request("review", "a".repeat(64), "22222222-2222-4222-8222-222222222222"),
    env,
    async () => reply(),
  );
  assert.equal(second.status, 200);
  const total = db
    .prepare("SELECT SUM(charged) AS total FROM review_requests")
    .get().total;
  assert.equal(total, reserved + 1150);
  const cached = await reviewModel(
    request("review", "a".repeat(64), "33333333-3333-4333-8333-333333333333"),
    env,
    async () => {
      throw Error("Completed response should be shared");
    },
  );
  assert.equal(cached.status, 200);
  assert.equal((await cached.json()).usage.cost, 0);
});
