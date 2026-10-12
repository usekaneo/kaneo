import { expect, it } from "vite-plus/test";
import { formatChipValue } from "./format-chip-value";

const selected = (count: number) => `${count} selected`;

it("names up to two values and counts the rest", () => {
  expect(formatChipValue(["John Doe"], selected)).toBe("John Doe");
  expect(formatChipValue(["Design", "Content"], selected)).toBe(
    "Design, Content",
  );
  expect(formatChipValue(["Low", "Medium", "High"], selected)).toBe(
    "3 selected",
  );
});
