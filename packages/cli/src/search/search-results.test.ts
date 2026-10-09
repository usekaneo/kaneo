import { describe, expect, it } from "vite-plus/test";
import type { SearchHit } from "../api/search.js";
import {
  normalizeSearchResults,
  type SearchContext,
  snippet,
} from "./search-results.js";

const context: SearchContext = {
  type: "all",
  workspaceId: "ws_acme",
  workspaceSlug: "acme-studio",
  webUrl: "https://kaneo.test",
};

const base = { createdAt: "2026-10-07T19:19:55.746Z", relevanceScore: 3 };

const task: SearchHit = {
  ...base,
  id: "t1",
  type: "task",
  title: "Fix login redirect",
  description: "<p>After the device   approval</p>",
  projectId: "p_kan",
  projectName: "Kaneo Web",
  projectSlug: "kan",
  workspaceId: "ws_acme",
  userName: "Ada Lovelace",
  taskNumber: 1,
  priority: "high",
  status: "in-progress",
};

const project: SearchHit = {
  ...base,
  id: "p_kan",
  type: "project",
  title: "Kaneo Web",
  projectId: "p_kan",
  projectSlug: "kan",
  workspaceId: "ws_acme",
};

const comment: SearchHit = {
  ...base,
  id: "a1",
  type: "comment",
  title: "Comment on Fix login redirect",
  content: "Still broken on Safari",
  projectId: "p_kan",
  projectSlug: "kan",
  workspaceId: "ws_acme",
  userName: "Grace Hopper",
  taskNumber: 1,
};

const activity: SearchHit = {
  ...base,
  id: "a2",
  type: "activity",
  title: "status_changed on Fix login redirect",
  content: "changed status from To Do to In Progress",
  projectId: "p_kan",
  projectSlug: "kan",
  workspaceId: "ws_acme",
  userName: "Ada Lovelace",
  taskNumber: 1,
};

const ownWorkspace: SearchHit = {
  ...base,
  id: "ws_acme",
  type: "workspace",
  title: "Acme Studio",
  workspaceId: "ws_acme",
};

const otherWorkspace: SearchHit = {
  ...base,
  id: "ws_side",
  type: "workspace",
  title: "Side Project",
  workspaceId: "ws_side",
};

describe("normalizeSearchResults", () => {
  it("maps a task to the stable result shape", () => {
    expect(normalizeSearchResults([task], context)).toEqual([
      {
        type: "task",
        id: "t1",
        title: "Fix login redirect",
        ticketId: "KAN-1",
        status: "in-progress",
        priority: "high",
        snippet: "After the device approval",
        projectId: "p_kan",
        projectKey: "KAN",
        projectName: "Kaneo Web",
        workspaceId: "ws_acme",
        assignee: "Ada Lovelace",
        author: null,
        createdAt: "2026-10-07T19:19:55.746Z",
        url: "https://kaneo.test/dashboard/workspace/ws_acme/project/p_kan/task/t1",
      },
    ]);
  });

  it("drops results from other workspaces and duplicates", () => {
    const results = normalizeSearchResults(
      [task, ownWorkspace, otherWorkspace, ownWorkspace, task],
      context,
    );
    expect(results.map((result) => `${result.type}:${result.id}`)).toEqual([
      "task:t1",
      "workspace:ws_acme",
    ]);
  });

  it("keeps only the requested kind, even when the server mixes comments into activity", () => {
    const results = normalizeSearchResults([task, comment, activity], {
      ...context,
      type: "activities",
    });
    expect(results.map((result) => result.id)).toEqual(["a2"]);
  });

  it("links comments and activity to the task through its ticket id", () => {
    const [first, second] = normalizeSearchResults(
      [comment, activity],
      context,
    );
    expect(first).toMatchObject({
      ticketId: "KAN-1",
      snippet: "Still broken on Safari",
      author: "Grace Hopper",
      assignee: null,
      url: "https://kaneo.test/acme-studio/task/KAN-1",
    });
    expect(second?.snippet).toBe("changed status from To Do to In Progress");
  });

  it("falls back to the project board when the workspace slug is unknown", () => {
    const [result] = normalizeSearchResults([comment], {
      ...context,
      workspaceSlug: null,
    });
    expect(result?.url).toBe(
      "https://kaneo.test/dashboard/workspace/ws_acme/project/p_kan/board",
    );
  });

  it("links projects and workspaces", () => {
    const results = normalizeSearchResults([project, ownWorkspace], context);
    expect(results.map((result) => result.url)).toEqual([
      "https://kaneo.test/dashboard/workspace/ws_acme/project/p_kan/board",
      "https://kaneo.test/dashboard/workspace/ws_acme",
    ]);
    expect(results[0]).toMatchObject({ projectKey: "KAN", ticketId: null });
  });

  it("keeps only results from the project passed with -p", () => {
    const elsewhere: SearchHit = {
      ...project,
      id: "p_mob",
      projectId: "p_mob",
      projectSlug: "mob",
    };
    const results = normalizeSearchResults(
      [task, project, elsewhere, ownWorkspace, comment],
      {
        ...context,
        projectId: "p_kan",
      },
    );
    expect(results.map((result) => `${result.type}:${result.id}`)).toEqual([
      "task:t1",
      "project:p_kan",
      "comment:a1",
    ]);
  });

  it("ignores result kinds this CLI does not know yet", () => {
    expect(
      normalizeSearchResults([{ ...task, type: "document" }], context),
    ).toEqual([]);
  });
});

describe("snippet", () => {
  it("flattens text and cuts long values", () => {
    expect(snippet(undefined)).toBeNull();
    expect(snippet("  \n ")).toBeNull();
    expect(snippet("one\n\ntwo")).toBe("one two");
    const long = snippet("x".repeat(300));
    expect(long).toHaveLength(200);
    expect(long?.endsWith("…")).toBe(true);
  });
});
