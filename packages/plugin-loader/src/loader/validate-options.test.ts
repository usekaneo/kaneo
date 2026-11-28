import { definePlugin } from "@kaneo/plugin-sdk";
import { describe, expect, it } from "vite-plus/test";
import { validateOptions } from "./validate-options.js";

describe("validateOptions", () => {
  it("applies field defaults when the operator calls the plugin with no options", async () => {
    const plugin = definePlugin(import.meta.url, {
      options: {
        "~standard": {
          version: 1,
          vendor: "test",
          validate: (value: unknown) =>
            value && typeof value === "object"
              ? { value: { autoComplete: true, ...value } }
              : { issues: [{ message: "Expected an object" }] },
        },
      },
    });

    await expect(validateOptions(plugin())).resolves.toEqual({
      autoComplete: true,
    });
  });

  it("honors a schema that accepts undefined directly", async () => {
    const plugin = definePlugin(import.meta.url, {
      options: {
        "~standard": {
          version: 1,
          vendor: "test",
          validate: (value: unknown) => ({ value }),
        },
      },
    });

    await expect(validateOptions(plugin())).resolves.toBeUndefined();
  });
});
