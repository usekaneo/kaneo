import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import deleteLabel from "./delete-label";

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock("@kaneo/libs", () => ({
  client: { label: { ":id": { $delete: request } } },
}));
const root = {
  id: "root",
  name: "bug",
  workspaceId: "workspace",
  taskId: null,
};
beforeEach(() => {
  request.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("resumable label deletion client", () => {
  it("awaits each batch and resolves only after the final response", async () => {
    let release!: (response: Response) => void;
    request
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            release = resolve;
          }),
      )
      .mockResolvedValueOnce(
        Response.json({ ...root, pendingDeletion: true }, { status: 202 }),
      )
      .mockResolvedValueOnce(Response.json(root));
    let finished = false;
    const operation = deleteLabel({ id: root.id }).then((result) => {
      finished = true;
      return result;
    });
    await Promise.resolve();
    expect(request).toHaveBeenCalledTimes(1);
    expect(finished).toBe(false);
    release(Response.json({ ...root, pendingDeletion: true }, { status: 202 }));
    await expect(operation).resolves.toEqual(root);
    expect(request.mock.calls).toEqual(
      Array.from({ length: 3 }, () => [{ param: { id: root.id } }]),
    );
  });

  it("surfaces an interrupted operation and resumes with the same label ID on retry", async () => {
    request
      .mockResolvedValueOnce(
        Response.json({ ...root, pendingDeletion: true }, { status: 202 }),
      )
      .mockRejectedValueOnce(new TypeError("Network unavailable"));
    await expect(deleteLabel({ id: root.id })).rejects.toThrow(
      "Network unavailable",
    );
    request.mockResolvedValueOnce(Response.json(root));
    await expect(deleteLabel({ id: root.id })).resolves.toEqual(root);
    expect(request).toHaveBeenLastCalledWith({ param: { id: root.id } });
  });

  it("backs off when busy and stops after five retries", async () => {
    vi.useFakeTimers();
    request.mockImplementation(
      async () => new Response("busy", { status: 429 }),
    );
    const operation = deleteLabel({ id: root.id });
    const rejection = expect(operation).rejects.toMatchObject({ status: 429 });
    await vi.advanceTimersByTimeAsync(999);
    expect(request).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(4001);
    await rejection;
    expect(request).toHaveBeenCalledTimes(6);
  });

  it("continues after temporary contention without reporting success early", async () => {
    vi.useFakeTimers();
    request
      .mockResolvedValueOnce(new Response("busy", { status: 429 }))
      .mockResolvedValueOnce(
        Response.json({ ...root, pendingDeletion: true }, { status: 202 }),
      )
      .mockResolvedValueOnce(Response.json(root));
    const operation = deleteLabel({ id: root.id });
    await vi.advanceTimersByTimeAsync(1000);
    await expect(operation).resolves.toEqual(root);
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("does not retry authorization failures", async () => {
    request.mockResolvedValueOnce(new Response("forbidden", { status: 403 }));
    await expect(deleteLabel({ id: root.id })).rejects.toMatchObject({
      status: 403,
    });
    expect(request).toHaveBeenCalledTimes(1);
  });
});
