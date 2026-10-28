import { describe, expect, it } from "vite-plus/test";
import { workspaceCapabilities } from "./capabilities";
import { statement } from "./index";

describe("workspaceCapabilities", () => {
  it("only names resources and actions from the permission statement", () => {
    const known = statement as Record<string, readonly string[]>;
    for (const [name, permissions] of Object.entries(workspaceCapabilities)) {
      for (const [resource, actions] of Object.entries(permissions)) {
        expect(known[resource], `${name} → ${resource}`).toBeDefined();
        for (const action of actions) {
          expect(known[resource], `${name} → ${resource}:${action}`).toContain(
            action,
          );
        }
      }
    }
  });
});
