import { expect, it } from "vite-plus/test";
import { layoutColumns } from "./layout-columns";

it("fits up to four layouts on one row and balances longer lists", () => {
  expect([3, 4, 5, 6, 7, 8, 9, 10].map(layoutColumns)).toEqual([
    3, 4, 3, 3, 4, 4, 3, 4,
  ]);
});
