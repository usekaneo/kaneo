import { HTTPException } from "hono/http-exception";
import { describe, expect, it } from "vitest";
import { rethrowItemTypeKeyConflict } from "../../apps/api/src/item-type/item-type-key-conflict";

describe("item type key conflict mapping", () => {
  it("maps the item type workspace key constraint to HTTP 409", () => {
    const databaseError = {
      cause: {
        code: "23505",
        constraint: "item_type_workspace_key_unique",
      },
    };

    let thrown: unknown;
    try {
      rethrowItemTypeKeyConflict(databaseError);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HTTPException);
    expect((thrown as HTTPException).status).toBe(409);
  });

  it("rethrows unique violations from other constraints unchanged", () => {
    const databaseError = {
      code: "23505",
      constraint: "some_other_unique_constraint",
    };

    let thrown: unknown;
    try {
      rethrowItemTypeKeyConflict(databaseError);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBe(databaseError);
  });

  it("rethrows non-database errors unchanged", () => {
    const error = new Error("connection failed");

    let thrown: unknown;
    try {
      rethrowItemTypeKeyConflict(error);
    } catch (caught) {
      thrown = caught;
    }

    expect(thrown).toBe(error);
  });
});
