import { defineWeb } from "@kaneo/plugin-sdk/web";
import { describe, expect, it } from "vite-plus/test";
import { normalizeWebDefinition } from "./normalize-web-definition";

const View = () => null;

describe("normalizeWebDefinition", () => {
  it("defaults a project view to the board scope without extras", () => {
    const [view] =
      normalizeWebDefinition(
        defineWeb({
          projectViews: [{ id: "chart", title: "Chart", component: View }],
        }),
      ).projectViews ?? [];

    expect(view).toMatchObject({
      id: "chart",
      scope: "board",
      display: undefined,
      countsTask: undefined,
    });
  });

  it("keeps a schedule scope, display controls and a count rule", () => {
    const countsTask = () => true;
    const [view] =
      normalizeWebDefinition(
        defineWeb({
          projectViews: [
            {
              id: "timeline",
              title: "Timeline",
              scope: "schedule",
              display: View,
              countsTask,
              component: View,
            },
          ],
        }),
      ).projectViews ?? [];

    expect(view).toMatchObject({
      scope: "schedule",
      display: View,
      countsTask,
    });
  });

  it("drops values that do not fit the contract", () => {
    const [view] =
      normalizeWebDefinition({
        kind: "kaneo-web",
        apiVersion: 1,
        projectViews: [
          {
            id: "odd",
            title: "Odd",
            scope: "backlog",
            display: "nope",
            countsTask: 3,
            component: View,
          },
        ],
      } as never).projectViews ?? [];

    expect(view).toMatchObject({
      scope: "board",
      display: undefined,
      countsTask: undefined,
    });
  });
});
