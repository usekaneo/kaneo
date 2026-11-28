import { describe, expect, it } from "vite-plus/test";
import { baseImportName, importNameFor } from "./import-name.js";

describe("baseImportName", () => {
  it("drops the scope and the kaneo-plugin- prefix and camel cases the rest", () => {
    expect(baseImportName("kaneo-plugin-task-progress")).toBe("taskProgress");
    expect(baseImportName("@acme/kaneo-plugin-time.report")).toBe("timeReport");
    expect(baseImportName("@kaneo/gantt")).toBe("gantt");
    expect(baseImportName("kaneo-reports")).toBe("kaneoReports");
    expect(baseImportName("kaneo-plugin")).toBe("kaneoPlugin");
    expect(baseImportName("my_plugin")).toBe("myPlugin");
  });

  it("always returns a valid identifier", () => {
    expect(baseImportName("kaneo-plugin-3d-view")).toBe("plugin3dView");
    expect(baseImportName("kaneo-plugin-delete")).toBe("deletePlugin");
    expect(baseImportName("kaneo-plugin-new")).toBe("newPlugin");
    expect(baseImportName("@acme/kaneo-plugin-")).toBe("plugin");
  });
});

describe("importNameFor", () => {
  it("adds a number until the name is free", () => {
    const taken = new Set(["taskProgress", "taskProgress2"]);
    expect(
      importNameFor("kaneo-plugin-task-progress", (name) => taken.has(name)),
    ).toBe("taskProgress3");
    expect(importNameFor("kaneo-plugin-task-progress", () => false)).toBe(
      "taskProgress",
    );
  });
});
