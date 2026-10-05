import { describe, expect, it } from "vite-plus/test";
import { toggleProjectId } from "./toggle-project-id";

describe("toggleProjectId", () => {
  it("adds a checked project once and removes an unchecked one", () => {
    expect(toggleProjectId(["a"], "b", true)).toEqual(["a", "b"]);
    expect(toggleProjectId(["a", "b"], "b", true)).toEqual(["a", "b"]);
    expect(toggleProjectId(["a", "b"], "a", false)).toEqual(["b"]);
  });
});
