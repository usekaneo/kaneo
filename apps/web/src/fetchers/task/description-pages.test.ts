import { beforeEach, describe, expect, it, vi } from "vitest";
import type Task from "@/types/task";
import { getDescriptionMatches } from "./get-description-matches";
import {
  getPublicTaskDescription,
  loadDescriptionPages,
} from "./get-description-pages";
import updateTask from "./update-task";

const { descriptionRequest, matchRequest, updateRequest } = vi.hoisted(() => ({
  descriptionRequest: vi.fn(),
  matchRequest: vi.fn(),
  updateRequest: vi.fn(),
}));
vi.mock("@kaneo/libs", () => ({
  client: {
    "public-project": {
      ":id": {
        task: { ":taskId": { description: { $get: descriptionRequest } } },
      },
    },
    task: {
      "description-matches": { ":projectId": { $get: matchRequest } },
      ":id": { $put: updateRequest },
    },
  },
}));
beforeEach(() => vi.resetAllMocks());

describe("deferred descriptions", () => {
  it("assembles full public text and forwards the first version plus cancellation on every page", async () => {
    descriptionRequest
      .mockResolvedValueOnce(
        Response.json({ content: "😺", version: "123", nextOffset: 1 }),
      )
      .mockResolvedValueOnce(
        Response.json({ content: "é", version: "123", nextOffset: null }),
      );
    const signal = new AbortController().signal;
    expect(await getPublicTaskDescription("project", "task", signal)).toBe(
      "😺é",
    );
    expect(descriptionRequest.mock.calls).toEqual([
      [
        {
          param: { id: "project", taskId: "task" },
          query: { offset: "0", version: undefined },
        },
        { init: { signal } },
      ],
      [
        {
          param: { id: "project", taskId: "task" },
          query: { offset: "1", version: "123" },
        },
        { init: { signal } },
      ],
    ]);
  });
  it("rejects a revoked public description without returning partial text", async () => {
    descriptionRequest
      .mockResolvedValueOnce(
        Response.json({ content: "partial", version: "1", nextOffset: 7 }),
      )
      .mockResolvedValueOnce(new Response("unavailable", { status: 409 }));
    await expect(
      getPublicTaskDescription("project", "task"),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("rejects changed versions and nonadvancing offsets", async () => {
    for (const next of [
      { version: "2", nextOffset: null },
      { version: "1", nextOffset: 1 },
    ]) {
      const load = vi
        .fn()
        .mockResolvedValueOnce({ content: "a", version: "1", nextOffset: 1 })
        .mockResolvedValueOnce({ content: "b", ...next });
      await expect(loadDescriptionPages(load)).rejects.toThrow();
      expect(load).toHaveBeenCalledTimes(2);
    }
  });
  it("stops loading after cancellation", async () => {
    const controller = new AbortController();
    const load = vi.fn(async () => {
      controller.abort();
      return { content: "a", version: "1", nextOffset: 1 };
    });
    await expect(
      loadDescriptionPages(load, controller.signal),
    ).rejects.toThrow();
    expect(load).toHaveBeenCalledTimes(1);
  });
  it("collects later description matches and rejects failures instead of claiming a complete search", async () => {
    const signal = new AbortController().signal;
    matchRequest
      .mockResolvedValueOnce(Response.json({ ids: ["a"], nextCursor: "a" }))
      .mockResolvedValueOnce(Response.json({ ids: ["b"], nextCursor: null }));
    expect(await getDescriptionMatches("project", "text", signal)).toEqual([
      "a",
      "b",
    ]);
    expect(matchRequest.mock.calls[1]).toEqual([
      { param: { projectId: "project" }, query: { query: "text", after: "a" } },
      { init: { signal } },
    ]);
    matchRequest
      .mockResolvedValueOnce(Response.json({ ids: ["a"], nextCursor: "a" }))
      .mockResolvedValueOnce(new Response("busy", { status: 503 }));
    await expect(
      getDescriptionMatches("project", "text"),
    ).rejects.toMatchObject({ status: 503 });
  });
  it("omits deferred text from generic board mutations but sends explicit ordinary edits", async () => {
    const task = {
      id: "task",
      title: "Task",
      projectId: "project",
      status: "to-do",
      description: null,
      descriptionDeferred: true,
    } as Task;
    updateRequest.mockImplementation(async () => Response.json(task));
    await updateTask(task.id, task);
    expect(updateRequest.mock.calls[0][0].json.description).toBeUndefined();
    await updateTask(task.id, {
      ...task,
      descriptionDeferred: false,
      description: "Edited",
    });
    expect(updateRequest.mock.calls[1][0].json.description).toBe("Edited");
    await updateTask(task.id, {
      ...task,
      descriptionDeferred: false,
      description: "",
    });
    expect(updateRequest.mock.calls[2][0].json.description).toBe("");
  });
});
