import assert from "node:assert/strict";
import test from "node:test";
import { createFixtureSession, fixture } from "../fixtures.mjs";

test("task route has matching project, task, and optional integration fixtures", () => {
  const api = (path) => fixture(`http://app/api/${path}`, "GET");
  const task = api("task/ui-review-task");
  assert.equal(task.projectId, api("project/ui-review-project").id);
  for (const route of [
    "custom-field/task/ui-review-task",
    "custom-field/project/ui-review-project",
    "task-relation/ui-review-task",
    "activity/ui-review-task",
  ])
    assert.deepEqual(api(route), []);
  assert.equal(api("github-integration/project/ui-review-project"), null);
  assert.equal(api("task/nonexistent"), undefined);
});

test("timer start and stop persist within one browser scenario and never leak between scenarios", () => {
  const a = createFixtureSession();
  const b = createFixtureSession();
  const list = (session) =>
    session("http://app/api/time-entry/task/ui-review-task", "GET");
  const started = a("http://app/api/time-entry", "POST", {
    taskId: "ui-review-task",
    startTime: "2026-09-17T12:00:00.000Z",
  });
  assert.equal(list(a).length, 2);
  assert.equal(list(b).length, 1);
  assert.equal(list(a).at(-1).endTime, null);
  a(`http://app/api/time-entry/${started.id}`, "PUT", {
    startTime: started.startTime,
    endTime: "2026-09-17T12:02:00.000Z",
  });
  assert.equal(list(a).at(-1).duration, 120);
});

test("custom-field values persist, preserve the API shape, and reset for each scenario", () => {
  const a = createFixtureSession({ customFields: true, multiselect: true });
  const b = createFixtureSession({ customFields: true, multiselect: true });
  const api = (session, route, method = "GET", body = {}) =>
    session(`http://app/api/${route}`, method, body);
  const [field] = api(a, "custom-field/project/ui-review-project");
  assert.equal(field.type, "multiselect");
  assert.deepEqual(field.options, ["Design", "Engineering", "Product"]);
  const value = JSON.stringify(["Design", "Engineering"]);
  api(a, "custom-field/value", "PUT", {
    taskId: "ui-review-task",
    fieldId: field.id,
    value,
  });
  assert.equal(api(a, "custom-field/task/ui-review-task")[0].value, value);
  assert.equal(
    api(b, "custom-field/task/ui-review-task")[0].value,
    '["Design"]',
  );
  assert.equal(
    api(a, "custom-field/value", "PUT", {
      taskId: "unknown",
      fieldId: field.id,
      value,
    }),
    undefined,
  );
  const base = createFixtureSession({ customFields: true });
  assert.equal(
    api(base, "custom-field/project/ui-review-project")[0].type,
    "dropdown",
  );
  assert.equal(
    api(base, "custom-field/task/ui-review-task")[0].value,
    "Design",
  );
  const result = api(a, "custom-field/project/ui-review-project");
  result[0].options.length = 0;
  assert.equal(
    api(a, "custom-field/project/ui-review-project")[0].options.length,
    3,
  );
});
