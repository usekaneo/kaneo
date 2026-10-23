import { describe, expect, it } from "vite-plus/test";
import { placeInProjectColumn } from "./place-in-project-column";

const t = (id: string, projectId = "web", status = "doing") => ({
  id,
  projectId,
  status,
});

describe("placeInProjectColumn", () => {
  it("follows the nearest same-column task above it in the lane", () => {
    expect(
      placeInProjectColumn({
        laneTasks: [t("a"), t("other", "ops"), t("x"), t("b")],
        task: t("x"),
        columnIds: ["b", "a", "x", "c"],
        statusChanged: false,
      }),
    ).toEqual(["b", "a", "x", "c"]);

    expect(
      placeInProjectColumn({
        laneTasks: [t("c"), t("x")],
        task: t("x"),
        columnIds: ["x", "a", "c"],
        statusChanged: false,
      }),
    ).toEqual(["a", "c", "x"]);
  });

  it("precedes the nearest same-column task below when none is above", () => {
    expect(
      placeInProjectColumn({
        laneTasks: [
          t("other", "ops"),
          t("x"),
          t("review", "web", "review"),
          t("b"),
        ],
        task: t("x"),
        columnIds: ["a", "b", "x"],
        statusChanged: false,
      }),
    ).toEqual(["a", "x", "b"]);
  });

  it("appends a task that changed column when it has no neighbours", () => {
    expect(
      placeInProjectColumn({
        laneTasks: [t("other", "ops"), t("x")],
        task: t("x"),
        columnIds: ["a", "b"],
        statusChanged: true,
      }),
    ).toEqual(["a", "b", "x"]);
  });

  it("leaves the project alone for a reorder with no same-project neighbours", () => {
    expect(
      placeInProjectColumn({
        laneTasks: [t("other", "ops"), t("x")],
        task: t("x"),
        columnIds: ["a", "x"],
        statusChanged: false,
      }),
    ).toBeNull();
  });
});
