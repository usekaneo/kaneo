import { expect, it } from "vite-plus/test";
import { setSubjectNegated } from "./set-subject-negated";

it("adds and removes a negated subject once", () => {
  expect(setSubjectNegated(null, "priority", true)).toEqual(["priority"]);
  expect(setSubjectNegated(["priority"], "priority", true)).toEqual([
    "priority",
  ]);
  expect(setSubjectNegated(["priority", "labels"], "priority", false)).toEqual([
    "labels",
  ]);
  expect(setSubjectNegated(["priority"], "priority", false)).toBeNull();
});
