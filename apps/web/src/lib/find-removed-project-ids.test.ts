import { expect, it } from "vite-plus/test";
import { findRemovedProjectIds } from "./find-removed-project-ids";

it("returns projects missing from the refreshed list", () => {
  expect(
    findRemovedProjectIds(
      [{ id: "kept" }, { id: "removed" }, { id: "also-removed" }],
      [{ id: "kept" }, { id: "added" }],
    ),
  ).toEqual(["removed", "also-removed"]);
});

it("reports each removed project once", () => {
  expect(
    findRemovedProjectIds([{ id: "removed" }, { id: "removed" }], []),
  ).toEqual(["removed"]);
});

it("removes nothing when either list is unknown", () => {
  expect(findRemovedProjectIds(undefined, [{ id: "kept" }])).toEqual([]);
  expect(findRemovedProjectIds([{ id: "kept" }], undefined)).toEqual([]);
});
