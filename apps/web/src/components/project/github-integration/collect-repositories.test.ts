import { describe, expect, it } from "vite-plus/test";
import { collectRepositories } from "./collect-repositories";

describe("collectRepositories", () => {
  it("flattens pages in order without duplicates", () => {
    expect(
      collectRepositories([
        { repositories: [{ id: 1 }, { id: 2 }] },
        { repositories: [{ id: 2 }, { id: 3 }] },
      ]).map((repository) => repository.id),
    ).toEqual([1, 2, 3]);
    expect(collectRepositories(undefined)).toEqual([]);
  });
});
