import { describe, expect, it } from "vitest";
import { rethrowSavedViewDatabaseError } from "../../apps/api/src/saved-view/controllers/upsert-saved-view";

describe("saved view database error mapping", () => {
  it("rethrows a unique violation for an unrelated constraint", () => {
    const error = Object.assign(new Error("unrelated unique violation"), {
      code: "23505",
      constraint: "some_other_unique_constraint",
    });

    expect(() => rethrowSavedViewDatabaseError(error)).toThrowError(error);
  });
});
