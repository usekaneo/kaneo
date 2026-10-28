import { describe, expect, it } from "vite-plus/test";
import { safeErrorCode } from "./safe-error-code";
import { ProbeTimeoutError } from "./with-timeout";

describe("safeErrorCode", () => {
  it("names timeouts", () => {
    expect(safeErrorCode(new ProbeTimeoutError())).toBe("TIMEOUT");
  });

  it("keeps driver codes and specific error names", () => {
    expect(
      safeErrorCode(Object.assign(new Error("x"), { code: "ECONNREFUSED" })),
    ).toBe("ECONNREFUSED");
    expect(
      safeErrorCode(Object.assign(new Error("x"), { code: "28P01" })),
    ).toBe("28P01");
    const notFound = new Error("bucket missing");
    notFound.name = "NoSuchBucket";
    expect(safeErrorCode(notFound)).toBe("NoSuchBucket");
  });

  it("never returns the message or malformed codes", () => {
    const error = Object.assign(
      new Error("password authentication failed for user admin"),
      { code: "connect to redis://:hunter2@cache:6379 failed" },
    );
    expect(safeErrorCode(error)).toBe("UNKNOWN");
    expect(safeErrorCode("redis://:hunter2@cache")).toBe("UNKNOWN");
    expect(safeErrorCode(null)).toBe("UNKNOWN");
  });
});
