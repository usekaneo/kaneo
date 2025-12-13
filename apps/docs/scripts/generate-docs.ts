import { generateFiles } from "fumadocs-openapi";
import { openapi } from "@/lib/openapi";

const pathToFolder: Record<string, string> = {
  "/github-integration": "github-integration",
  "/project": "projects",
  "/task": "tasks",
  "/label": "labels",
  "/time-entry": "time-entries",
  "/notification": "notifications",
  "/search": "",
  "/config": "",
};

void generateFiles({
  input: openapi,
  output: "./content/docs/api",
  per: "operation",
  groupBy: (entry) => {
    const path = entry.type === "operation" ? entry.item.path : "";

    if (path.startsWith("/activity")) {
      return path.includes("/comment") ? "comments" : "activities";
    }

    for (const [prefix, folder] of Object.entries(pathToFolder)) {
      if (path.startsWith(prefix)) {
        return folder;
      }
    }

    return "";
  },
  includeDescription: false,
});
