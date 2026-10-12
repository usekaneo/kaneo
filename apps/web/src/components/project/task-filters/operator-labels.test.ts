import { expect, it } from "vite-plus/test";
import { operatorLabels } from "./operator-labels";

const t = (key: string) => key.split(".").pop() ?? key;

it("words single and multiple selections like a sentence", () => {
  expect(operatorLabels("is", 1, t)).toEqual({
    positive: "is",
    negative: "isNot",
  });
  expect(operatorLabels("is", 3, t)).toEqual({
    positive: "isAnyOf",
    negative: "isNoneOf",
  });
  expect(operatorLabels("include", 2, t)).toEqual({
    positive: "includeAnyOf",
    negative: "exclude",
  });
});
