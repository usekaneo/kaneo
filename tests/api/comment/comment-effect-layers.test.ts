import { Effect, Layer } from "effect";
import { describe, expect, it } from "vitest";
import createComment from "../../../apps/api/src/activity/controllers/create-comment";
import deleteComment from "../../../apps/api/src/activity/controllers/delete-comment";
import updateComment from "../../../apps/api/src/activity/controllers/update-comment";
import { CommentNotFoundOrNotAuthor } from "../../../apps/api/src/comment/errors";
import {
  AssetCleanup,
  Notifications,
} from "../../../apps/api/src/comment/services";
import {
  makeTestDatabase,
  makeTestEvents,
} from "../../../apps/api/src/effect/testing";

const NOW = new Date("2026-09-18T10:00:00.000Z");

const COMMENT = {
  id: "act-1",
  taskId: "task-1",
  type: "comment",
  createdAt: NOW,
  updatedAt: NOW,
  userId: "user-1",
  content: 'hello <kaneo-mention id="user-2">@Bob</kaneo-mention>',
  eventData: null,
  externalUserName: null,
  externalUserAvatar: null,
  externalSource: null,
  externalUrl: null,
};

function failureOf(effect: Effect.Effect<unknown, unknown>) {
  return Effect.runPromise(effect).then(
    () => {
      throw new Error("expected the effect to fail");
    },
    (error: unknown) => error,
  );
}

function selectSequence(results: unknown[][]) {
  const queue = [...results];
  const chain = {
    from: () => chain,
    innerJoin: () => chain,
    where: () => {
      const rows = queue.shift() ?? [];
      return Object.assign(Promise.resolve(rows), {
        limit: () => Promise.resolve(rows),
      });
    },
  };
  return () => chain;
}

function returning(rows: unknown[]) {
  const terminal = { returning: () => Promise.resolve(rows) };
  return () => ({
    values: () => terminal,
    set: () => ({ where: () => terminal }),
    where: () => terminal,
  });
}

function makeTestServices() {
  const notifications: unknown[] = [];
  const cleanups: unknown[] = [];
  const layer = Layer.mergeAll(
    Layer.succeed(Notifications, {
      create: (input) =>
        Effect.sync(() => {
          notifications.push(input);
        }),
    }),
    Layer.succeed(AssetCleanup, {
      deleteOrphaned: (...args) =>
        Effect.sync(() => {
          cleanups.push(args);
        }),
    }),
  );
  return { layer, notifications, cleanups };
}

describe("comment controllers through the Effect test layers", () => {
  it("updateComment fails when the comment is not the caller's", async () => {
    const database = makeTestDatabase({ select: selectSequence([[]]) });
    const services = makeTestServices();
    const events = makeTestEvents();

    const error = await failureOf(
      Effect.provide(
        updateComment("user-9", "act-1", "edited"),
        Layer.mergeAll(database, events.layer, services.layer),
      ),
    );

    expect(error).toBeInstanceOf(CommentNotFoundOrNotAuthor);
    expect(error).toMatchObject({ id: "act-1", userId: "user-9" });
    expect(events.published).toEqual([]);
    expect(services.cleanups).toEqual([]);
  });

  it("updateComment publishes comment.updated and schedules asset cleanup", async () => {
    const updated = { ...COMMENT, content: "edited" };
    const database = makeTestDatabase({
      select: selectSequence([
        [{ id: "act-1", content: COMMENT.content, taskId: "task-1" }],
        [{ projectId: "proj-1" }],
      ]),
      update: returning([updated]),
    });
    const services = makeTestServices();
    const events = makeTestEvents();

    const result = await Effect.runPromise(
      Effect.provide(
        updateComment("user-1", "act-1", "edited"),
        Layer.mergeAll(database, events.layer, services.layer),
      ),
    );

    expect(result).toEqual(updated);
    expect(events.published).toEqual([
      {
        type: "comment.updated",
        data: { ...updated, projectId: "proj-1", userId: "user-1" },
      },
    ]);
    expect(services.cleanups).toEqual([
      [COMMENT.content, "edited", { taskId: "task-1" }],
    ]);
  });

  it("deleteComment publishes comment.deleted and cleans up all assets", async () => {
    const database = makeTestDatabase({
      select: selectSequence([
        [{ id: "act-1", content: COMMENT.content, taskId: "task-1" }],
        [{ projectId: "proj-1" }],
      ]),
      delete: returning([COMMENT]),
    });
    const services = makeTestServices();
    const events = makeTestEvents();

    await Effect.runPromise(
      Effect.provide(
        deleteComment("user-1", "act-1"),
        Layer.mergeAll(database, events.layer, services.layer),
      ),
    );

    expect(events.published).toEqual([
      {
        type: "comment.deleted",
        data: { ...COMMENT, projectId: "proj-1", userId: "user-1" },
      },
    ]);
    expect(services.cleanups).toEqual([
      [COMMENT.content, null, { taskId: "task-1" }],
    ]);
  });

  it("createComment notifies mentioned users and the assignee once each", async () => {
    const database = makeTestDatabase({
      insert: returning([COMMENT]),
      select: selectSequence([
        [{ name: "Ada" }],
        [
          {
            assigneeId: "user-3",
            projectId: "proj-1",
            title: "Write docs",
            workspaceId: "ws-1",
          },
        ],
      ]),
    });
    const services = makeTestServices();
    const events = makeTestEvents();

    const result = await Effect.runPromise(
      Effect.provide(
        createComment("task-1", "user-1", COMMENT.content),
        Layer.mergeAll(database, events.layer, services.layer),
      ),
    );

    expect(result).toEqual(COMMENT);
    expect(events.published).toEqual([
      {
        type: "comment.created",
        data: {
          ...COMMENT,
          comment: `**Ada** commented:\n> ${COMMENT.content}`,
          projectId: "proj-1",
        },
      },
    ]);
    expect(services.notifications).toEqual([
      {
        userId: "user-2",
        type: "task_mention",
        eventData: {
          taskTitle: "Write docs",
          mentionerName: "Ada",
          projectId: "proj-1",
          workspaceId: "ws-1",
        },
        resourceId: "task-1",
        resourceType: "task",
      },
      {
        userId: "user-3",
        type: "task_comment",
        eventData: {
          taskTitle: "Write docs",
          commenterName: "Ada",
          commentPreview: COMMENT.content,
          projectId: "proj-1",
          workspaceId: "ws-1",
        },
        resourceId: "task-1",
        resourceType: "task",
      },
    ]);
  });
});
