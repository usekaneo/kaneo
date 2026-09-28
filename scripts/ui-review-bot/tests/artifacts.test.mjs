import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { PNG } from "pngjs";
import { importCapture, readBounded } from "../ci.mjs";

const scenario = {
  name: "Settings",
  beforePath: "/settings",
  afterPath: "/settings",
  actions: [],
};
const good = {
  ok: true,
  errors: [],
  unhandled: [],
  actions: [],
  text: "Settings",
};

test("review stage keeps trusted identity and rejects paths, assessments, and percentages from capture", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "ui-artifact-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const input = path.join(root, "input");
  const output = path.join(root, "output");
  await mkdir(input);
  const run = { prNumber: 1719, plan: { scenarios: [scenario] } };
  await writeFile(
    path.join(input, "capture.json"),
    JSON.stringify({
      prNumber: 999,
      results: [
        {
          name: "INJECTED",
          review: { summary: "Everything passed" },
          before: { ...good, image: "/secret.env" },
          after: good,
          difference: { percent: 99 },
        },
      ],
    }),
  );
  const bytes = PNG.sync.write(new PNG({ width: 1440, height: 1000 }));
  for (const side of ["before", "after", "diff"])
    await writeFile(path.join(input, `0-${side}.png`), bytes);
  await importCapture(run, input, output);
  assert.equal(run.prNumber, 1719);
  assert.equal(run.results[0].name, "Settings");
  assert.equal(run.results[0].before.image, "0-before.png");
  assert.equal(run.results[0].review, undefined);
  assert.equal(run.results[0].difference.percent, 0);
  await writeFile(
    path.join(input, "0-before.png"),
    PNG.sync.write(new PNG({ width: 1, height: 1 })),
  );
  await assert.rejects(importCapture(run, input, output), /Invalid screenshot/);
});

test("artifact reads reject symlinks and excessive size", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "ui-artifact-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(path.join(root, "real"), "12345");
  await symlink(path.join(root, "real"), path.join(root, "link"));
  await assert.rejects(readBounded(root, "link", 100), /Invalid artifact/);
  await assert.rejects(readBounded(root, "real", 2), /Invalid artifact/);
});

test("trusted focus plans require bounded previews and ignore capture-supplied image paths", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "ui-focus-artifact-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const output = path.join(root, "output");
  const run = {
    prNumber: 1735,
    plan: {
      scenarios: [{ ...scenario, focus: { by: "text", name: "Feature" } }],
    },
  };
  await writeFile(
    path.join(root, "capture.json"),
    JSON.stringify({
      results: [
        {
          before: good,
          after: { ...good, preview: true, image: "/secret.env" },
        },
      ],
    }),
  );
  const full = PNG.sync.write(new PNG({ width: 1440, height: 1000 }));
  for (const side of ["before", "after"])
    await writeFile(path.join(root, `0-${side}.png`), full);
  await assert.rejects(importCapture(run, root, output), /ENOENT/);
  await writeFile(
    path.join(root, "0-preview.png"),
    PNG.sync.write(new PNG({ width: 784, height: 200 })),
  );
  await importCapture(run, root, output);
  assert.equal(run.results[0].after.preview, true);
  assert.equal(run.results[0].focus.name, "Feature");
  await writeFile(
    path.join(root, "0-preview.png"),
    PNG.sync.write(new PNG({ width: 1, height: 1 })),
  );
  await assert.rejects(importCapture(run, root, output), /Invalid screenshot/);
});
