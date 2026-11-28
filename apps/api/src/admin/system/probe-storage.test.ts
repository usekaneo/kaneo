import { describe, expect, it } from "vite-plus/test";
import { storageFailureStatus } from "./probe-storage";

describe("storageFailureStatus", () => {
  it("warns for Azure permission failures and rejects missing containers", () => {
    expect(storageFailureStatus({ statusCode: 403 })).toBe("warning");
    expect(storageFailureStatus({ statusCode: 404 })).toBe("down");
  });

  it("warns when the bucket refuses to be listed", () => {
    expect(storageFailureStatus({ $metadata: { httpStatusCode: 403 } })).toBe(
      "warning",
    );
  });

  it("is down for a missing bucket or an unreachable endpoint", () => {
    expect(storageFailureStatus({ $metadata: { httpStatusCode: 404 } })).toBe(
      "down",
    );
    expect(
      storageFailureStatus(
        Object.assign(new Error(), { code: "ECONNREFUSED" }),
      ),
    ).toBe("down");
  });
});
