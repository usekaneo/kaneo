import { Effect, Layer, Option, Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { KaneoApiLayer } from "../api/kaneo-api.js";
import type { ResolvedTask } from "../tasks/resolve-task.js";
import {
  captureOutput,
  fakeHttpClient,
  json,
  memoryConfigStore,
  type RecordedRequest,
  type Responder,
  testSession,
} from "../testing/test-layers.js";
import { linkToParent, projectOrParent } from "./link-subtask.js";

const parent: ResolvedTask = {
  task: {
    id: "parent",
    projectId: "p1",
    number: 1,
    title: "Auth overhaul",
    description: null,
    status: "to-do",
    priority: "no-priority",
    startDate: null,
    dueDate: null,
    createdAt: "2026-10-08T10:00:00.000Z",
    assigneeId: null,
    assigneeName: null,
  },
  workspaceId: "ws_1",
  project: {
    id: "p1",
    workspaceId: "ws_1",
    slug: "kan",
    name: "Kaneo Web",
    icon: null,
    description: null,
    archivedAt: null,
    position: 0,
    lastTaskNumber: 9,
  },
  columns: [],
  ticketId: "KAN-1",
  url: "https://kaneo.test/task/parent",
};

function run(respond: Responder) {
  const recorded: RecordedRequest[] = [];
  const api = KaneoApiLayer.pipe(
    Layer.provide(
      Layer.mergeAll(
        fakeHttpClient(respond, recorded),
        testSession(),
        memoryConfigStore().layer,
      ),
    ),
  );
  const effect = linkToParent(parent, {
    id: "child",
    label: "KAN-9",
    argument: "KAN-9",
  }).pipe(Effect.provide(Layer.mergeAll(api, captureOutput().layer)));
  return { recorded, result: Effect.runPromise(Effect.result(effect)) };
}

describe("linkToParent", () => {
  it("links the new task as a subtask of the parent", async () => {
    const { recorded, result } = run(() =>
      json({
        id: "r1",
        sourceTaskId: "parent",
        targetTaskId: "child",
        relationType: "subtask",
      }),
    );
    expect(await result).toEqual(
      Result.succeed({
        id: "parent",
        ticketId: "KAN-1",
        title: "Auth overhaul",
        url: "https://kaneo.test/task/parent",
      }),
    );
    expect(recorded[0]).toMatchObject({
      method: "POST",
      url: "https://kaneo.test/api/task-relation",
      body: {
        sourceTaskId: "parent",
        targetTaskId: "child",
        relationType: "subtask",
      },
    });
  });

  it("says the task was created but not linked when the link fails", async () => {
    const { result } = run(() => json({ message: "Missing permission" }, 403));
    const outcome = await result;
    expect(Result.isFailure(outcome)).toBe(true);
    if (Result.isFailure(outcome)) {
      expect(outcome.failure).toMatchObject({
        _tag: "InvalidArgument",
        message:
          "Created KAN-9, but could not make it a subtask of KAN-1: Missing permission",
        hint: "Link it with kaneo task relation add KAN-9 subtask-of KAN-1",
      });
    }
  });

  it("does nothing without a parent", async () => {
    const effect = linkToParent(undefined, {
      id: "child",
      label: "KAN-9",
      argument: "KAN-9",
    });
    expect(
      await Effect.runPromise(
        effect.pipe(
          Effect.provide(
            Layer.mergeAll(
              KaneoApiLayer.pipe(
                Layer.provide(
                  Layer.mergeAll(
                    fakeHttpClient(() => json({})),
                    testSession(),
                    memoryConfigStore().layer,
                  ),
                ),
              ),
              captureOutput().layer,
            ),
          ),
        ),
      ),
    ).toBeNull();
  });
});

describe("projectOrParent", () => {
  it("prefers the -p flag", () => {
    expect(projectOrParent(Option.some("MOB"), parent)).toEqual(
      Option.some("MOB"),
    );
  });

  it("uses the parent's project without -p", () => {
    expect(projectOrParent(Option.none(), parent)).toEqual(Option.some("p1"));
  });

  it("leaves the project open without a parent", () => {
    expect(projectOrParent(Option.none(), undefined)).toEqual(Option.none());
  });
});
