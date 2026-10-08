import { describe, expect, it } from "vite-plus/test";
import { CliError } from "../../../apps/api/src/cli/cli-error";
import {
  baseImportName,
  importNameFor,
} from "../../../apps/api/src/cli/commands/add/import-name";
import { parsePackageName } from "../../../apps/api/src/cli/commands/add/package-name";

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

describe("parsePackageName", () => {
  it("accepts plain and scoped names", () => {
    expect(parsePackageName(" kaneo-plugin-task-progress ")).toBe(
      "kaneo-plugin-task-progress",
    );
    expect(parsePackageName("@acme/kaneo-reports")).toBe("@acme/kaneo-reports");
  });

  it("rejects versions and invalid names", () => {
    expect(() => parsePackageName("kaneo-plugin-x@1.2.0")).toThrow(
      "Run kaneo add kaneo-plugin-x without a version.",
    );
    expect(() => parsePackageName("@acme/reports@latest")).toThrow(
      "Run kaneo add @acme/reports without a version.",
    );
    expect(() => parsePackageName("Not Valid")).toThrow(CliError);
    expect(() => parsePackageName("../local")).toThrow(
      "is not a valid npm package name",
    );
  });
});
