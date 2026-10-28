import { describe, expect, it } from "vite-plus/test";
import { uniqueNames } from "./unique-names";

describe("uniqueNames", () => {
  it("keeps the first spelling of names that match ignoring case", () => {
    expect(
      uniqueNames(["To do", " Done ", "to DO", "", "done", "Review"]),
    ).toEqual(["To do", "Done", "Review"]);
  });
});
