import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
import { Route } from "./$ticketId";

const getTaskByTicketId = vi.fn();
const handleUnauthorized = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  redirect: (options: unknown) => ({ redirect: options }),
  Link: () => null,
}));

vi.mock("@/fetchers/task/get-task-by-ticket-id", () => ({
  default: (...args: unknown[]) => getTaskByTicketId(...args),
}));

vi.mock("@/lib/http-error", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/http-error")>()),
  handleUnauthorized: () => handleUnauthorized(),
}));

type LoaderArgs = {
  params: { ticketId: string };
  context: { session: { session: { activeOrganizationId?: string } } | null };
};

const loader = (Route as unknown as { loader: (args: LoaderArgs) => unknown })
  .loader;

const task = { id: "task-1", projectId: "project-1", workspaceId: "ws-2" };

function load(activeOrganizationId?: string) {
  return loader({
    params: { ticketId: "KAN-12" },
    context: { session: { session: { activeOrganizationId } } },
  });
}

const taskRedirect = {
  redirect: {
    to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
    params: { workspaceId: "ws-2", projectId: "project-1", taskId: "task-1" },
    replace: true,
  },
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("task ticket ID route", () => {
  it("opens the task in the active workspace first", async () => {
    getTaskByTicketId.mockResolvedValue(task);
    await expect(load("ws-2")).rejects.toEqual(taskRedirect);
    expect(getTaskByTicketId).toHaveBeenCalledTimes(1);
    expect(getTaskByTicketId).toHaveBeenCalledWith("KAN-12", "ws-2");
  });

  it("falls back to every workspace when the active one has no match", async () => {
    getTaskByTicketId
      .mockRejectedValueOnce(new HttpError(404, "Task not found"))
      .mockResolvedValueOnce(task);
    await expect(load("ws-1")).rejects.toEqual(taskRedirect);
    expect(getTaskByTicketId).toHaveBeenLastCalledWith("KAN-12");
  });

  it("looks across workspaces when none is active", async () => {
    getTaskByTicketId.mockResolvedValue(task);
    await expect(load()).rejects.toEqual(taskRedirect);
    expect(getTaskByTicketId).toHaveBeenCalledWith("KAN-12");
  });

  it("reports an ID that matches tasks in several workspaces", async () => {
    getTaskByTicketId
      .mockRejectedValueOnce(new HttpError(404, "Task not found"))
      .mockRejectedValueOnce(new HttpError(409, "Ambiguous"));
    await expect(load("ws-1")).resolves.toEqual({ failure: "ambiguous" });
  });

  it.each([400, 404])("reports a missing task for a %i", async (status) => {
    getTaskByTicketId.mockRejectedValue(new HttpError(status, "nope"));
    await expect(load()).resolves.toEqual({ failure: "notFound" });
  });

  it("sends an expired session to sign in", async () => {
    getTaskByTicketId.mockRejectedValue(new HttpError(401, "Unauthorized"));
    await expect(load()).resolves.toBeUndefined();
    expect(handleUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("surfaces unexpected failures", async () => {
    const error = new HttpError(500, "boom");
    getTaskByTicketId.mockRejectedValue(error);
    await expect(load("ws-1")).rejects.toBe(error);
  });
});
