import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import {
  headUploadedObject,
  UPLOAD_VISIBILITY_RETRY_DELAYS_MS,
} from "../../../apps/api/src/storage/head-uploaded-object";

function storageError(status: number, name = "Unknown") {
  return Object.assign(new Error("UnknownError"), {
    name,
    $metadata: { httpStatusCode: status },
  });
}

async function settle<T>(promise: Promise<T>) {
  promise.catch(() => {});
  await vi.runAllTimersAsync();
  return promise;
}

describe("headUploadedObject", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns the object metadata on the first successful check", async () => {
    const send = vi.fn().mockResolvedValue({ ContentLength: 12 });

    await expect(
      settle(
        headUploadedObject(
          { send },
          "kaneo",
          "a.png",
          new AbortController().signal,
        ),
      ),
    ).resolves.toEqual({ ContentLength: 12 });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("retries while storage briefly refuses a fresh upload", async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(storageError(403))
      .mockRejectedValueOnce(storageError(403))
      .mockResolvedValue({ ContentLength: 12 });

    await expect(
      settle(
        headUploadedObject(
          { send },
          "kaneo",
          "a.png",
          new AbortController().signal,
        ),
      ),
    ).resolves.toEqual({ ContentLength: 12 });
    expect(send).toHaveBeenCalledTimes(3);
  });

  it("gives up with the last storage error after the retry budget", async () => {
    const send = vi.fn().mockRejectedValue(storageError(403));

    await expect(
      settle(
        headUploadedObject(
          { send },
          "kaneo",
          "a.png",
          new AbortController().signal,
        ),
      ),
    ).rejects.toMatchObject({ $metadata: { httpStatusCode: 403 } });
    expect(send).toHaveBeenCalledTimes(
      UPLOAD_VISIBILITY_RETRY_DELAYS_MS.length + 1,
    );
  });

  it("does not retry missing objects", async () => {
    const send = vi.fn().mockRejectedValue(storageError(404, "NotFound"));

    await expect(
      settle(
        headUploadedObject(
          { send },
          "kaneo",
          "a.png",
          new AbortController().signal,
        ),
      ),
    ).rejects.toMatchObject({ name: "NotFound" });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("does not retry other storage failures", async () => {
    const send = vi.fn().mockRejectedValue(storageError(500));

    await expect(
      settle(
        headUploadedObject(
          { send },
          "kaneo",
          "a.png",
          new AbortController().signal,
        ),
      ),
    ).rejects.toMatchObject({ $metadata: { httpStatusCode: 500 } });
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("stops retrying once the verification is aborted", async () => {
    const controller = new AbortController();
    controller.abort();
    const send = vi.fn().mockRejectedValue(storageError(403));

    await expect(
      settle(headUploadedObject({ send }, "kaneo", "a.png", controller.signal)),
    ).rejects.toMatchObject({ $metadata: { httpStatusCode: 403 } });
    expect(send).toHaveBeenCalledTimes(1);
  });
});
