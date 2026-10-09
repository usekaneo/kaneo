import { Effect, Layer, Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { KaneoApiLayer } from "../api/kaneo-api.js";
import {
  fakeHttpClient,
  json,
  memoryConfigStore,
  type RecordedRequest,
  testSession,
} from "../testing/test-layers.js";
import { loadTaskView } from "./load-task-view.js";
import { sectionValue } from "./section-result.js";
import {
  commentsFixture,
  relationsFixture,
  resolvedTask,
  sectionsFixture,
  timeFixture,
} from "./test-task-view.js";

type Routes = Readonly<Record<string, () => Response>>;

const baseRoutes: Routes = {
  "/api/task/by-ticket-id/KAN-12": () => json(resolvedTask.task),
  "/api/project/p1": () => json(resolvedTask.project),
  "/api/column/p1": () => json(resolvedTask.columns),
  "/api/label/task/t12": () => json(sectionValue(sectionsFixture.labels)),
  "/api/task-relation/t12": () => json(relationsFixture.slice(0, 8)),
  "/api/external-link/task/t12": () =>
    json(sectionValue(sectionsFixture.links)),
  "/api/custom-field/task/t12": () =>
    json(sectionValue(sectionsFixture.fields)),
  "/api/time-entry/task/t12": () => json(timeFixture),
  "/api/comment/t12": () => json(commentsFixture),
  "/api/project": () =>
    json([
      resolvedTask.project,
      { ...resolvedTask.project, id: "p2", slug: "mob" },
    ]),
  "/api/user/me": () => json({ message: "Unauthorized" }, 401),
};

function run(
  routes: Routes = {},
  options: { readonly comments: boolean } = { comments: true },
) {
  const recorded: RecordedRequest[] = [];
  const all = { ...baseRoutes, ...routes };
  const layer = KaneoApiLayer.pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        fakeHttpClient((request) => {
          const route = all[new URL(request.url).pathname];
          return route ? route() : json({ message: "Not found" }, 404);
        }, recorded),
        testSession(),
        memoryConfigStore().layer,
      ),
    ),
  );
  const result = Effect.runPromise(
    Effect.result(loadTaskView("KAN-12", options).pipe(Effect.provide(layer))),
  );
  const paths = () =>
    recorded.map((request) => new URL(request.url).pathname).sort();
  return { result, paths };
}

describe("loadTaskView", () => {
  it("loads the task and every section", async () => {
    const { result, paths } = run();
    const loaded = Result.getOrThrow(await result);
    expect(loaded.resolved).toEqual(resolvedTask);
    expect(loaded.sections.labels._tag).toBe("Loaded");
    expect(sectionValue(loaded.sections.relations)).toHaveLength(8);
    expect(sectionValue(loaded.sections.comments)).toHaveLength(5);
    expect(loaded.projectSlugs).toEqual(new Map([["p1", "kan"]]));
    expect(paths()).toEqual([
      "/api/column/p1",
      "/api/comment/t12",
      "/api/custom-field/task/t12",
      "/api/external-link/task/t12",
      "/api/label/task/t12",
      "/api/project/p1",
      "/api/task-relation/t12",
      "/api/task/by-ticket-id/KAN-12",
      "/api/time-entry/task/t12",
    ]);
  });

  it("skips the comments request when no comments are wanted", async () => {
    const { result, paths } = run({}, { comments: false });
    const loaded = Result.getOrThrow(await result);
    expect(sectionValue(loaded.sections.comments)).toEqual([]);
    expect(paths()).not.toContain("/api/comment/t12");
  });

  it("looks up project keys only for tasks linked from other projects", async () => {
    const { result, paths } = run({
      "/api/task-relation/t12": () => json(relationsFixture),
    });
    const loaded = Result.getOrThrow(await result);
    expect(loaded.projectSlugs.get("p2")).toBe("mob");
    expect(paths()).toContain("/api/project");
  });

  it("keeps going when a section fails", async () => {
    const { result } = run({
      "/api/external-link/task/t12": () => json({ message: "boom" }, 500),
      "/api/time-entry/task/t12": () =>
        json({ message: "You cannot see time entries" }, 403),
    });
    const loaded = Result.getOrThrow(await result);
    expect(loaded.sections.links).toEqual({
      _tag: "Failed",
      message: "The server failed with 500: boom",
    });
    expect(loaded.sections.time).toEqual({
      _tag: "Failed",
      message: "You cannot see time entries",
    });
    expect(loaded.sections.fields._tag).toBe("Loaded");
  });

  it("fails as usual when the session has expired", async () => {
    const { result } = run({
      "/api/comment/t12": () => json({ message: "Unauthorized" }, 401),
    });
    const failure = await result;
    expect(Result.isFailure(failure) && failure.failure._tag).toBe(
      "SessionExpired",
    );
  });

  it("fails as usual when the task does not exist", async () => {
    const { result } = run({
      "/api/task/by-ticket-id/KAN-12": () => json({ message: "nope" }, 404),
    });
    const failure = await result;
    expect(Result.isFailure(failure) && failure.failure).toMatchObject({
      _tag: "NotFound",
      message: "Task KAN-12 not found.",
    });
  });
});
