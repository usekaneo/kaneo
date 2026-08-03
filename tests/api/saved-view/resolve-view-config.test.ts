import { describe, expect, it } from "vitest";
import resolveViewConfig, {
  type ViewConfigLayer,
} from "../../../apps/api/src/saved-view/resolve-view-config";

describe("resolveViewConfig", () => {
  it("merges layers by scope precedence", () => {
    const layers: ViewConfigLayer[] = [
      {
        scope: "workspace",
        configuration: { density: "comfortable", fields: ["priority"] },
      },
      {
        scope: "project",
        configuration: { density: "compact", groupBy: "status" },
      },
      { scope: "user", configuration: { groupBy: "assignee" } },
    ];

    expect(resolveViewConfig(layers)).toEqual({
      density: "compact",
      fields: ["priority"],
      groupBy: "assignee",
    });
  });

  it("applies precedence regardless of the original layer order", () => {
    const layers: ViewConfigLayer[] = [
      { scope: "user", configuration: { groupBy: "assignee" } },
      {
        scope: "workspace",
        configuration: { density: "comfortable", fields: ["priority"] },
      },
      {
        scope: "project",
        configuration: { density: "compact", groupBy: "status" },
      },
    ];

    expect(resolveViewConfig(layers)).toEqual({
      density: "compact",
      fields: ["priority"],
      groupBy: "assignee",
    });
  });

  it("does not mutate the source layers or their configurations", () => {
    const layers: ViewConfigLayer[] = [
      { scope: "user", configuration: { groupBy: "assignee" } },
      { scope: "workspace", configuration: { density: "comfortable" } },
    ];
    const originalLayers = structuredClone(layers);

    resolveViewConfig(layers);

    expect(layers).toEqual(originalLayers);
    expect(layers[0]).not.toBe(originalLayers[0]);
    expect(layers[0]?.configuration).not.toBe(originalLayers[0]?.configuration);
  });

  it("returns a new empty configuration when there are no layers", () => {
    expect(resolveViewConfig([])).toEqual({});
  });
});
