import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vite-plus/test";
import { collectCachedProjects } from "./collect-cached-projects";

describe("collectCachedProjects", () => {
  it("gathers projects from every cached list and single project query", () => {
    const client = new QueryClient();
    client.setQueryData(["projects", "ws"], [{ id: "active" }]);
    client.setQueryData(
      ["projects", "ws", "including-archived"],
      [{ id: "active" }, { id: "archived" }],
    );
    client.setQueryData(["projects", "ws", "visited"], { id: "visited" });
    client.setQueryData(["projects", "other"], [{ id: "elsewhere" }]);

    expect(
      collectCachedProjects(client, "ws")
        .map((project) => project.id)
        .sort(),
    ).toEqual(["active", "archived", "visited"]);
  });
});
