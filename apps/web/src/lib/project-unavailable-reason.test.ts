import { describe, expect, it } from "vite-plus/test";
import { HttpError } from "./http-error";
import { getProjectUnavailableReason } from "./project-unavailable-reason";

describe("getProjectUnavailableReason", () => {
  it("maps 403 to no access and 404 to not found", () => {
    expect(getProjectUnavailableReason(new HttpError(403, "denied"))).toBe(
      "forbidden",
    );
    expect(getProjectUnavailableReason(new HttpError(404, "missing"))).toBe(
      "notFound",
    );
  });

  it("ignores other failures so they keep their own handling", () => {
    expect(getProjectUnavailableReason(new HttpError(500, "boom"))).toBeNull();
    expect(getProjectUnavailableReason(new Error("offline"))).toBeNull();
    expect(getProjectUnavailableReason(null)).toBeNull();
  });
});
