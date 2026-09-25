import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { PNG } from "pngjs";
import {
  ATTRIBUTION,
  commentBody,
  MARKER,
  publisherActor,
  publishReport,
} from "../publish.mjs";

const run = {
  id: "test-run",
  prNumber: 1719,
  pr: { number: 1719 },
  revisions: { after: "a".repeat(40) },
  status: "complete",
  model: "INTERNAL_MODEL",
  usage: { cost: 123 },
  error: "INTERNAL_DIAGNOSTICS",
  results: [
    "Account navigation",
    "Change-password form",
    "Filled password fields",
  ].map((name) => ({
    name,
    status: "captured",
    after: { ok: true },
    review: {
      caption: name,
      summary: "INTERNAL_REVIEW",
      coverage: "INTERNAL_COVERAGE",
    },
  })),
};
const images = run.results.map((item, i) => ({
  description: item.name,
  url: `https://raw.githubusercontent.com/usekaneo/kaneo/${"b".repeat(40)}/screenshots/pr-1719/test-run/${i + 1}.png`,
}));

function mock(
  comments = [],
  {
    head = run.revisions.after,
    existingBranch = false,
    failUpload = false,
    changedDuringUpload = false,
  } = {},
) {
  const writes = [];
  let headReads = 0;
  const api = async (endpoint, options) => {
    if (options?.body) {
      writes.push({ endpoint, ...options });
      if (endpoint.endsWith("/git/blobs") && failUpload)
        throw new Error("Upload denied");
      if (endpoint.includes("/git/")) return { sha: "b".repeat(40) };
      return {
        html_url: "https://github.com/usekaneo/kaneo/pull/1719#issuecomment-1",
      };
    }
    if (endpoint === "user") return { login: "tinsever" };
    if (endpoint.includes("/comments?")) return comments;
    if (endpoint.endsWith("/pulls/1719"))
      return {
        state: "open",
        head: {
          sha: changedDuringUpload && headReads++ > 0 ? "c".repeat(40) : head,
        },
      };
    if (endpoint.includes("/matching-refs/"))
      return existingBranch
        ? [
            {
              ref: "refs/heads/code/ui-screenshots",
              object: { sha: "d".repeat(40) },
            },
          ]
        : [];
    if (endpoint.includes("/git/commits/"))
      return { tree: { sha: "e".repeat(40) } };
    throw new Error(`Unexpected endpoint: ${endpoint}`);
  };
  return { api, writes };
}

async function screenshots(t) {
  const folder = await mkdtemp(path.join(tmpdir(), "ui-publish-test-"));
  t.after(() => rm(folder, { recursive: true, force: true }));
  const bytes = PNG.sync.write(new PNG({ width: 1440, height: 1000 }));
  for (let i = 0; i < 3; i++)
    await writeFile(path.join(folder, `${i}-after.png`), bytes);
  await writeFile(path.join(folder, "report.json"), "MUST_NOT_UPLOAD");
  return folder;
}

test("comment contains the requested attribution, three screenshots, and collapsed findings and run info", () => {
  const text = commentBody(run, { images });
  assert.equal(text.split("\n")[0], ATTRIBUTION);
  assert.equal((text.match(/!\[Screenshot\]/g) || []).length, 3);
  assert.equal(text.includes("INTERNAL_DIAGNOSTICS"), false);
  assert.equal(text.includes("INTERNAL_REVIEW"), false);
  assert.equal(text.includes("INTERNAL_COVERAGE"), false);
  assert.equal(text.includes("123"), false);
  assert.equal(text.split("<details>")[0].trim().split("\n").length, 7);
  assert.equal((text.match(/<details>/g) || []).length, 2);
  assert.ok(text.includes("<summary>Findings (Beta)</summary>"));
  assert.ok(text.includes("<summary>Run info</summary>"));
  assert.ok(!text.includes("<details open"));
  assert.throws(() => commentBody(run), /Upload the PR screenshots/);
});

test("manual publishing ignores other authors' markers and preserves exact attribution", async () => {
  const { api, writes } = mock([
    { id: 9, user: { login: "other" }, body: MARKER },
  ]);
  await publishReport(run, { actor: "tinsever", images }, api);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].method, "POST");
  assert.equal(writes[0].body.body.split("\n")[0], ATTRIBUTION);
});

test("reruns update the existing author's old or new comment format", async () => {
  for (const body of [
    `${MARKER}\nold report`,
    `${ATTRIBUTION}\ntable\n${MARKER}`,
  ]) {
    const { api, writes } = mock([
      { id: 42, user: { login: "tinsever" }, body },
    ]);
    await publishReport(run, { actor: "tinsever", images }, api);
    assert.equal(writes[0].method, "PATCH");
    assert.match(writes[0].endpoint, /comments\/42$/);
  }
});

test("stale or failed reports cannot post", async () => {
  const { api, writes } = mock([], { head: "b".repeat(40) });
  await assert.rejects(
    publishReport(run, { actor: "tinsever", images }, api),
    /PR changed/,
  );
  await assert.rejects(
    publishReport(
      { ...run, status: "failed" },
      { actor: "tinsever", images },
      api,
    ),
    /Only completed/,
  );
  assert.equal(writes.length, 0);
});

test("captions cannot inject Markdown, HTML, or mentions; non-GitHub image URLs are rejected", () => {
  const text = commentBody(run, {
    images: [
      {
        ...images[0],
        description:
          "@everyone <img src=x> ![click](https://evil.example)\n| forged",
      },
    ],
  });
  for (const injection of [
    "@everyone",
    "<img",
    "![click](https://evil.example)",
    "\n| forged",
  ])
    assert.equal(text.includes(injection), false);
  assert.throws(
    () =>
      commentBody(run, {
        images: [{ description: "x", url: "https://evil.example/a.png" }],
      }),
    /uploaded GitHub/,
  );
});

test("bot authors update their own comments", async () => {
  const { api, writes } = mock([
    { id: 17, user: { login: "github-actions[bot]" }, body: MARKER },
  ]);
  await publishReport(run, { actor: "github-actions[bot]", images }, api);
  assert.equal(writes[0].method, "PATCH");
});

test("publishing automatically uploads only the three PR PNGs before posting their image URLs", async (t) => {
  const folder = await screenshots(t);
  const { api, writes } = mock();
  await publishReport(run, { actor: "tinsever", folder }, api);
  const blobs = writes.filter((w) => w.endpoint.endsWith("/blobs"));
  assert.equal(blobs.length, 3);
  for (const blob of blobs) {
    assert.equal(blob.body.encoding, "base64");
    const png = PNG.sync.read(Buffer.from(blob.body.content, "base64"));
    assert.equal(png.width, 1440);
  }
  const tree = writes.find((w) => w.endpoint.endsWith("/trees"));
  assert.deepEqual(
    tree.body.tree.map((x) => x.path),
    [1, 2, 3].map((i) => `screenshots/pr-1719/test-run/${i}.png`),
  );
  assert.equal(
    writes.find((w) => w.endpoint.endsWith("/refs")).body.ref,
    "refs/heads/code/ui-screenshots",
  );
  assert.equal(writes.at(-1).body.body, commentBody(run, { images }));
});

test("existing screenshot branch keeps previous images and never force pushes", async (t) => {
  const folder = await screenshots(t);
  const { api, writes } = mock([], { existingBranch: true });
  await publishReport(run, { actor: "tinsever", folder }, api);
  assert.equal(
    writes.find((w) => w.endpoint.endsWith("/trees")).body.base_tree,
    "e".repeat(40),
  );
  assert.deepEqual(
    writes.find((w) => w.endpoint.endsWith("/commits")).body.parents,
    ["d".repeat(40)],
  );
  assert.equal(
    writes.find((w) => w.endpoint.includes("/refs/heads/")).body.force,
    false,
  );
});

test("upload failure or a new PR commit during upload prevents commenting", async (t) => {
  const folder = await screenshots(t);
  for (const options of [{ failUpload: true }, { changedDuringUpload: true }]) {
    const { api, writes } = mock([], options);
    await assert.rejects(
      publishReport(run, { actor: "tinsever", folder }, api),
      /Upload denied|PR changed/,
    );
    assert.equal(
      writes.some((w) => w.endpoint.includes("/issues/")),
      false,
    );
  }
});

test("invalid screenshots fail before any upload or comment", async (t) => {
  const folder = await screenshots(t);
  await writeFile(path.join(folder, "2-after.png"), "not an image");
  const { api, writes } = mock();
  await assert.rejects(
    publishReport(run, { actor: "tinsever", folder }, api),
    /Invalid screenshot/,
  );
  assert.equal(writes.length, 0);
});

test("App identity works with installation tokens and fails closed when missing in CI", () => {
  assert.equal(
    publisherActor({
      GITHUB_ACTIONS: "true",
      UI_REVIEW_BOT_LOGIN: "diffshot[bot]",
    }),
    "diffshot[bot]",
  );
  assert.equal(
    publisherActor({ UI_REVIEW_BOT_LOGIN: "my-ui-bot[bot]" }),
    "my-ui-bot[bot]",
  );
  assert.equal(publisherActor({}), undefined);
  assert.throws(
    () => publisherActor({ GITHUB_ACTIONS: "true" }),
    /Set UI_REVIEW_BOT_LOGIN/,
  );
  assert.throws(
    () => publisherActor({ UI_REVIEW_BOT_LOGIN: "someone" }),
    /App slug/,
  );
});

test("custom App updates only its own comment without requesting a user endpoint", async () => {
  const { api, writes } = mock([
    { id: 1, user: { login: "github-actions[bot]" }, body: MARKER },
    { id: 2, user: { login: "diffshot[bot]" }, body: MARKER },
  ]);
  const installationAPI = (endpoint, options) => {
    assert.notEqual(endpoint, "user");
    return api(endpoint, options);
  };
  await publishReport(run, { actor: "diffshot[bot]", images }, installationAPI);
  assert.match(writes.at(-1).endpoint, /comments\/2$/);
});

test("uploads retry a branch conflict against the new tip without overwriting another run", async (t) => {
  const folder = await screenshots(t);
  const { api, writes } = mock([], { existingBranch: true });
  let updates = 0;
  const concurrentAPI = async (endpoint, options) => {
    if (endpoint.includes("/matching-refs/") && updates > 0)
      return [
        {
          ref: "refs/heads/code/ui-screenshots",
          object: { sha: "f".repeat(40) },
        },
      ];
    if (endpoint.includes("/refs/heads/") && ++updates === 1) {
      const error = new Error("Conflict");
      error.status = 422;
      throw error;
    }
    return api(endpoint, options);
  };
  await publishReport(run, { actor: "tinsever", folder }, concurrentAPI);
  const commits = writes.filter((w) => w.endpoint.endsWith("/commits"));
  assert.equal(commits.length, 2);
  assert.deepEqual(commits[1].body.parents, ["f".repeat(40)]);
  assert.equal(writes.filter((w) => w.endpoint.endsWith("/blobs")).length, 3);
});

test("closed PRs cannot receive an outdated screenshot comment", async () => {
  const { api, writes } = mock();
  await assert.rejects(
    publishReport(
      run,
      { actor: "tinsever", images },
      async (endpoint, options) => {
        if (endpoint.endsWith("/pulls/1719"))
          return { state: "closed", head: { sha: run.revisions.after } };
        return api(endpoint, options);
      },
    ),
    /closed/,
  );
  assert.equal(writes.length, 0);
});

test("focused previews are uploaded instead of full captures, with concise fallback captions", async (t) => {
  const folder = await screenshots(t);
  const focused = structuredClone(run);
  for (const [i, item] of focused.results.entries()) {
    item.focus = { by: "text", name: "Feature" };
    item.after.preview = true;
    item.review.caption = "Generic long caption ".repeat(10);
    const png = new PNG({ width: 784, height: 200 + i });
    await writeFile(path.join(folder, `${i}-preview.png`), PNG.sync.write(png));
  }
  const { api, writes } = mock();
  await publishReport(focused, { actor: "tinsever", folder }, api);
  const uploaded = writes.filter((w) => w.endpoint.endsWith("/blobs"));
  assert.equal(uploaded.length, 3);
  assert.equal(
    PNG.sync.read(Buffer.from(uploaded[0].body.content, "base64")).width,
    784,
  );
  assert.ok(!writes.at(-1).body.body.includes("Generic long"));
  assert.ok(writes.at(-1).body.body.includes("Account navigation"));
});

test("duplicate or missing focused previews fail before uploading anything", async (t) => {
  const folder = await screenshots(t);
  const focused = structuredClone(run);
  const bytes = PNG.sync.write(new PNG({ width: 784, height: 200 }));
  for (const [i, item] of focused.results.entries()) {
    item.focus = { by: "text", name: "Feature" };
    item.after.preview = true;
    await writeFile(path.join(folder, `${i}-preview.png`), bytes);
  }
  const { api, writes } = mock();
  await assert.rejects(
    publishReport(focused, { actor: "tinsever", folder }, api),
    /Duplicate previews/,
  );
  focused.results[0].after.preview = false;
  await assert.rejects(
    publishReport(focused, { actor: "tinsever", folder }, api),
    /Missing focused preview/,
  );
  assert.equal(writes.length, 0);
});
