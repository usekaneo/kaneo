import type {
  PluginEvent,
  PluginStorage,
  StorageEntry,
} from "@kaneo/plugin-sdk/server";
import { describe, expect, it } from "vite-plus/test";
import type { Kaneo } from "./context.js";
import { registerEvents } from "./events.js";
import { progressKey } from "./progress-key.js";

type MemoryStorage = PluginStorage & { data: Map<string, unknown> };

function memoryStorage(): MemoryStorage {
  const data = new Map<string, unknown>();
  return {
    data,
    async get<T>(key: string) {
      return data.get(key) as T | undefined;
    },
    async set(key, value) {
      data.set(key, value);
    },
    async delete(key) {
      data.delete(key);
    },
    async list<T>({ prefix = "", limit = 100 } = {}) {
      return [...data.keys()]
        .filter((key) => key.startsWith(prefix))
        .sort()
        .slice(0, limit)
        .map((key): StorageEntry<T> => ({
          key,
          value: data.get(key) as T,
          updatedAt: "2026-10-11T00:00:00.000Z",
        }));
    },
  };
}

function setup() {
  const storages = new Map<string, MemoryStorage>();
  const storage = (workspaceId: string) => {
    const existing = storages.get(workspaceId);
    if (existing) return existing;
    const created = memoryStorage();
    storages.set(workspaceId, created);
    return created;
  };
  const handlers = new Map<string, (event: PluginEvent) => Promise<void>>();
  registerEvents({
    options: { autoComplete: true },
    settings: async () => ({ doneStatus: "done" }),
    storage,
    on: (name: string, handler: (event: PluginEvent) => Promise<void>) => {
      handlers.set(name, handler);
    },
  } as unknown as Kaneo);
  const moveProject = (projectId: string, from: string, to: string) =>
    handlers.get("project.moved")!({
      type: "project.moved",
      workspaceId: to,
      projectId,
      actorId: "user-1",
      fromWorkspaceId: from,
      toWorkspaceId: to,
    });
  return { storage, moveProject };
}

describe("project.moved", () => {
  it("moves the project's progress to the destination workspace", async () => {
    const { storage, moveProject } = setup();
    const source = storage("workspace-a");
    await source.set(progressKey("project-1", "task-1"), 40);
    await source.set(progressKey("project-1", "task-2"), 100);
    await source.set(progressKey("project-2", "task-3"), 10);

    await moveProject("project-1", "workspace-a", "workspace-b");

    expect(Object.fromEntries(storage("workspace-b").data)).toEqual({
      [progressKey("project-1", "task-1")]: 40,
      [progressKey("project-1", "task-2")]: 100,
    });
    expect(Object.fromEntries(source.data)).toEqual({
      [progressKey("project-2", "task-3")]: 10,
    });
  });

  it("keeps a value set in the destination after the move", async () => {
    const { storage, moveProject } = setup();
    const key = progressKey("project-1", "task-1");
    await storage("workspace-a").set(key, 40);
    await storage("workspace-b").set(key, 75);

    await moveProject("project-1", "workspace-a", "workspace-b");

    expect(await storage("workspace-b").get(key)).toBe(75);
    expect(storage("workspace-a").data.size).toBe(0);
  });

  it("moves more entries than one storage page holds", async () => {
    const { storage, moveProject } = setup();
    const source = storage("workspace-a");
    for (let task = 0; task < 2500; task++) {
      await source.set(progressKey("project-1", `task-${task}`), task % 101);
    }

    await moveProject("project-1", "workspace-a", "workspace-b");

    expect(source.data.size).toBe(0);
    expect(storage("workspace-b").data.size).toBe(2500);
    expect(
      await storage("workspace-b").get(progressKey("project-1", "task-2499")),
    ).toBe(2499 % 101);
  });
});
