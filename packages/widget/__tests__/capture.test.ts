import { afterEach, expect, it, vi } from "vite-plus/test";
import { captureScreenshot } from "../src/ui/capture.js";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
it("reports unsupported capture and treats chooser cancellation as no attachment", async () => {
  vi.stubGlobal("navigator", { mediaDevices: undefined });
  await expect(captureScreenshot(new AbortController().signal)).rejects.toThrow(
    "unavailable",
  );
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getDisplayMedia: vi
        .fn()
        .mockRejectedValue(new DOMException("cancel", "NotAllowedError")),
    },
  });
  await expect(
    captureScreenshot(new AbortController().signal),
  ).resolves.toBeNull();
});
it("stops tracks when a late chooser resolves after navigation", async () => {
  let resolve!: (stream: MediaStream) => void;
  vi.stubGlobal("navigator", {
    mediaDevices: {
      getDisplayMedia: () =>
        new Promise<MediaStream>((done) => {
          resolve = done;
        }),
    },
  });
  const stop = vi.fn(),
    controller = new AbortController();
  const result = captureScreenshot(controller.signal);
  const stream = Object.assign(new MediaStream(), {
    getTracks: () => [{ stop } as unknown as MediaStreamTrack],
  });
  controller.abort();
  resolve(stream);
  await expect(result).resolves.toBeNull();
  expect(stop).toHaveBeenCalled();
});
it("stops tracks on decode failure and on successful PNG capture", async () => {
  const stop = vi.fn();
  const stream = Object.assign(new MediaStream(), {
    getTracks: () => [{ stop } as unknown as MediaStreamTrack],
  });
  const getDisplayMedia = vi.fn().mockResolvedValue(stream);
  vi.stubGlobal("navigator", { mediaDevices: { getDisplayMedia } });
  const play = vi
    .spyOn(HTMLMediaElement.prototype, "play")
    .mockRejectedValueOnce(new Error("decode"));
  await expect(captureScreenshot(new AbortController().signal)).rejects.toThrow(
    "read the captured screen",
  );
  expect(stop).toHaveBeenCalledTimes(1);
  play.mockImplementation(function (this: HTMLVideoElement) {
    Object.defineProperties(this, {
      videoWidth: { value: 4096 },
      videoHeight: { value: 2048 },
    });
    queueMicrotask(() => this.dispatchEvent(new Event("loadeddata")));
    return Promise.resolve();
  });
  const draw = vi.fn();
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: draw,
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toBlob").mockImplementation(
    (callback) => callback(new Blob(["png"], { type: "image/png" })),
  );
  const file = await captureScreenshot(new AbortController().signal);
  expect(file?.type).toBe("image/png");
  expect(draw).toHaveBeenCalledWith(
    expect.any(HTMLVideoElement),
    0,
    0,
    2048,
    1024,
  );
  expect(stop).toHaveBeenCalledTimes(2);
  expect(getDisplayMedia).toHaveBeenCalledWith({ video: true, audio: false });
});
