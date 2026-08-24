import { beforeEach, describe, expect, it, vi } from "vitest";
import { removeProjectBackground, uploadProjectBackground } from "./background";

const mocks = vi.hoisted(() => ({
  createUpload: vi.fn(),
  finalizeUpload: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@kaneo/libs", () => ({
  client: {
    project: {
      ":id": {
        "background-upload": {
          $put: mocks.createUpload,
          finalize: { $post: mocks.finalizeUpload },
        },
        background: { $delete: mocks.remove },
      },
    },
  },
}));

describe("project background fetchers", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mocks.createUpload.mockReset();
    mocks.finalizeUpload.mockReset();
    mocks.remove.mockReset();
  });

  it("uploads the file with the signed headers before finalizing it", async () => {
    const file = new File(["image bytes"], "board.png", {
      type: "image/png",
    });
    mocks.createUpload.mockResolvedValue({
      ok: true,
      json: async () => ({
        key: "workspace/ws/project/project-1/backgrounds/background-v1",
        uploadUrl: "https://storage.example.test/upload",
        version: "v1",
        headers: { "Content-Type": "image/png" },
      }),
    });
    const storageFetch = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(null, { status: 200 }));
    mocks.finalizeUpload.mockResolvedValue({
      ok: true,
      json: async () => ({ url: "/api/project/project-1/background?v=v1" }),
    });

    await expect(uploadProjectBackground("project-1", file)).resolves.toEqual({
      url: "/api/project/project-1/background?v=v1",
    });

    expect(mocks.createUpload).toHaveBeenCalledWith({
      param: { id: "project-1" },
      json: { contentType: "image/png", size: file.size },
    });
    expect(storageFetch).toHaveBeenCalledWith(
      "https://storage.example.test/upload",
      {
        method: "PUT",
        headers: { "Content-Type": "image/png" },
        body: file,
      },
    );
    expect(mocks.finalizeUpload).toHaveBeenCalledWith({
      param: { id: "project-1" },
      json: {
        key: "workspace/ws/project/project-1/backgrounds/background-v1",
        contentType: "image/png",
        size: file.size,
        version: "v1",
      },
    });
  });

  it("does not finalize when object storage rejects the upload", async () => {
    const file = new File(["image bytes"], "board.png", {
      type: "image/png",
    });
    mocks.createUpload.mockResolvedValue({
      ok: true,
      json: async () => ({
        key: "background-v1",
        uploadUrl: "https://storage.example.test/upload",
        version: "v1",
        headers: { "Content-Type": "image/png" },
      }),
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 413 }),
    );

    await expect(uploadProjectBackground("project-1", file)).rejects.toThrow(
      "Failed to upload background image.",
    );
    expect(mocks.finalizeUpload).not.toHaveBeenCalled();
  });

  it("removes the project background", async () => {
    mocks.remove.mockResolvedValue({ ok: true });

    await removeProjectBackground("project-1");

    expect(mocks.remove).toHaveBeenCalledWith({
      param: { id: "project-1" },
    });
  });
});
