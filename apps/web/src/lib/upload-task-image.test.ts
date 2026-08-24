import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { uploadTaskImage } from "./upload-task-image";

const mocks = vi.hoisted(() => ({
  createImageUpload: vi.fn(),
  finalizeImageUpload: vi.fn(),
}));

vi.mock("@/fetchers/task/create-image-upload", () => ({
  default: mocks.createImageUpload,
  finalizeImageUpload: mocks.finalizeImageUpload,
}));

describe("uploadTaskImage", () => {
  beforeEach(() => {
    mocks.createImageUpload.mockResolvedValue({
      key: "task/file.conf",
      uploadUrl: "https://storage.example/upload",
      headers: {},
    });
    mocks.finalizeImageUpload.mockResolvedValue({
      url: "https://storage.example/file.conf",
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("uses a generic content type when the browser cannot detect one", async () => {
    const file = new File(["server config"], "server.conf");

    const asset = await uploadTaskImage({
      taskId: "task-1",
      surface: "comment",
      file,
    });

    expect(file.type).toBe("");
    expect(mocks.createImageUpload).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "application/octet-stream" }),
    );
    expect(mocks.finalizeImageUpload).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "application/octet-stream" }),
    );
    expect(asset.mimeType).toBe("application/octet-stream");
    expect(asset.kind).toBe("attachment");
  });

  it("preserves a browser-provided content type", async () => {
    const file = new File(["image"], "image.png", { type: "image/png" });

    const asset = await uploadTaskImage({
      taskId: "task-1",
      surface: "description",
      file,
    });

    expect(mocks.createImageUpload).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "image/png" }),
    );
    expect(mocks.finalizeImageUpload).toHaveBeenCalledWith(
      expect.objectContaining({ contentType: "image/png" }),
    );
    expect(asset.mimeType).toBe("image/png");
    expect(asset.kind).toBe("image");
  });
});
