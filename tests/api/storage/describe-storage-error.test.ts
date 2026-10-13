import { describe, expect, it } from "vite-plus/test";
import { describeStorageError } from "../../../apps/api/src/storage/describe-storage-error";

describe("describeStorageError", () => {
  it("keeps the SDK error name and HTTP status", () => {
    const error = Object.assign(new Error("UnknownError"), {
      name: "Forbidden",
      $metadata: { httpStatusCode: 403 },
    });

    expect(describeStorageError(error)).toEqual({
      name: "Forbidden",
      status: 403,
    });
  });

  it("keeps network error codes without the message", () => {
    const error = Object.assign(
      new Error("getaddrinfo ENOTFOUND bucket.storage.example.test"),
      { code: "ENOTFOUND" },
    );

    const described = describeStorageError(error);

    expect(described).toEqual({ name: "Error", code: "ENOTFOUND" });
    expect(JSON.stringify(described)).not.toContain("storage.example.test");
  });

  it("reads the status from the raw response when metadata is missing", () => {
    const error = Object.assign(new Error("Deserialization error"), {
      $response: { statusCode: 200 },
    });

    expect(describeStorageError(error)).toEqual({
      name: "Error",
      status: 200,
    });
  });

  it("reads codes from the error cause", () => {
    const error = new Error("socket hang up", {
      cause: { code: "ECONNRESET" },
    });

    expect(describeStorageError(error)).toEqual({
      name: "Error",
      code: "ECONNRESET",
    });
  });

  it("describes non-error values by type", () => {
    expect(describeStorageError("boom")).toEqual({ name: "string" });
  });
});
