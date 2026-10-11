import { describe, expect, it } from "vite-plus/test";
import { addPluginToConfig } from "./add-plugin-to-config.js";
import { configTemplate } from "./config-template.js";

const lines = (...parts: string[]) => parts.join("\n");

function updated(source: string, packageName = "kaneo-plugin-time-report") {
  const result = addPluginToConfig(source, packageName);
  expect(result.status).toBe("updated");
  return result.status === "updated" ? result.source : "";
}

function manualReason(source: string): string {
  const result = addPluginToConfig(source, "kaneo-plugin-time-report");
  expect(result).toMatchObject({ status: "manual", importName: "timeReport" });
  return result.status === "manual" ? result.reason : "";
}

describe("addPluginToConfig", () => {
  it("adds the import after the last import and the call to a one-line array", () => {
    const source = lines(
      'import { defineConfig } from "@kaneo/config";',
      'import taskProgress from "kaneo-plugin-task-progress";',
      "",
      "export default defineConfig({",
      "  plugins: [taskProgress({ autoComplete: true })],",
      "});",
      "",
    );
    expect(updated(source)).toBe(
      lines(
        'import { defineConfig } from "@kaneo/config";',
        'import taskProgress from "kaneo-plugin-task-progress";',
        'import timeReport from "kaneo-plugin-time-report";',
        "",
        "export default defineConfig({",
        "  plugins: [taskProgress({ autoComplete: true }), timeReport()],",
        "});",
        "",
      ),
    );
  });

  it("keeps a multi-line array's trailing comma, indentation, and comments", () => {
    const source = lines(
      'import { defineConfig } from "@kaneo/config";',
      "import {",
      "  reports,",
      '} from "@acme/reports";',
      "",
      "export default defineConfig({",
      "  plugins: [",
      "    reports({",
      "      token: process.env.TOKEN,",
      "    }),",
      "    // more later",
      "  ],",
      "});",
      "",
    );
    expect(updated(source)).toBe(
      lines(
        'import { defineConfig } from "@kaneo/config";',
        "import {",
        "  reports,",
        '} from "@acme/reports";',
        'import timeReport from "kaneo-plugin-time-report";',
        "",
        "export default defineConfig({",
        "  plugins: [",
        "    reports({",
        "      token: process.env.TOKEN,",
        "    }),",
        "    timeReport(),",
        "    // more later",
        "  ],",
        "});",
        "",
      ),
    );
  });

  it("adds a comma when the last element has none, before its comment", () => {
    const source = lines(
      "import { defineConfig } from '@kaneo/config'",
      "export default defineConfig({",
      "  plugins: [",
      "    a(),",
      "    b() // keep",
      "  ]",
      "})",
      "",
    );
    expect(updated(source)).toBe(
      lines(
        "import { defineConfig } from '@kaneo/config'",
        "import timeReport from 'kaneo-plugin-time-report'",
        "export default defineConfig({",
        "  plugins: [",
        "    a(),",
        "    b(), // keep",
        "    timeReport()",
        "  ]",
        "})",
        "",
      ),
    );
  });

  it("fills an empty array", () => {
    expect(
      updated(
        lines(
          'import { defineConfig } from "@kaneo/config";',
          "export default defineConfig({ plugins: [] });",
        ),
      ),
    ).toBe(
      lines(
        'import { defineConfig } from "@kaneo/config";',
        'import timeReport from "kaneo-plugin-time-report";',
        "export default defineConfig({ plugins: [timeReport()] });",
      ),
    );
    expect(
      updated(
        lines(
          'import { defineConfig } from "@kaneo/config";',
          "export default defineConfig({",
          "  plugins: [",
          "    // nothing yet",
          "  ],",
          "});",
        ),
      ),
    ).toBe(
      lines(
        'import { defineConfig } from "@kaneo/config";',
        'import timeReport from "kaneo-plugin-time-report";',
        "export default defineConfig({",
        "  plugins: [",
        "    timeReport(),",
        "    // nothing yet",
        "  ],",
        "});",
      ),
    );
  });

  it("creates the plugins array when defineConfig has none", () => {
    expect(
      updated(
        lines(
          'import { defineConfig } from "@kaneo/config";',
          "",
          "export default defineConfig({",
          "  official: { gantt: false },",
          "});",
          "",
        ),
      ),
    ).toBe(
      lines(
        'import { defineConfig } from "@kaneo/config";',
        'import timeReport from "kaneo-plugin-time-report";',
        "",
        "export default defineConfig({",
        "  official: { gantt: false },",
        "  plugins: [timeReport()],",
        "});",
        "",
      ),
    );
    expect(
      updated(
        lines(
          'import { defineConfig } from "@kaneo/config";',
          "export default defineConfig({});",
        ),
      ),
    ).toBe(
      lines(
        'import { defineConfig } from "@kaneo/config";',
        'import timeReport from "kaneo-plugin-time-report";',
        "export default defineConfig({ plugins: [timeReport()] });",
      ),
    );
    expect(
      updated(
        lines(
          'import { defineConfig } from "@kaneo/config";',
          "export default defineConfig({ official: { gantt: false } });",
        ),
      ),
    ).toContain(
      "defineConfig({ official: { gantt: false }, plugins: [timeReport()] });",
    );
  });

  it("does not mistake a nested or quoted plugins key", () => {
    expect(
      updated(
        lines(
          'import { defineConfig } from "@kaneo/config";',
          "export default defineConfig({",
          "  official: { plugins: false },",
          "});",
        ),
      ),
    ).toContain("  official: { plugins: false },\n  plugins: [timeReport()],");
    expect(
      updated(
        lines(
          'import { defineConfig } from "@kaneo/config";',
          'export default defineConfig({ "plugins": [a()] });',
        ),
      ),
    ).toContain('{ "plugins": [a(), timeReport()] }');
  });

  it("ignores brackets and keywords inside strings, templates, and comments", () => {
    const source = [
      'import { defineConfig } from "@kaneo/config";',
      "/* defineConfig({ plugins: [ */",
      `const url = \`\${process.env.HOST ?? "}"}/api\`;`,
      "export default defineConfig({",
      '  plugins: [a({ label: "] plugins: [" })],',
      "});",
    ].join("\n");
    expect(updated(source)).toContain(
      '  plugins: [a({ label: "] plugins: [" }), timeReport()],',
    );
  });

  it("edits .js configs and plain default export objects", () => {
    expect(
      updated(
        lines(
          "#!/usr/bin/env node",
          "export default {",
          "  plugins: [],",
          "};",
          "",
        ),
      ),
    ).toBe(
      lines(
        "#!/usr/bin/env node",
        'import timeReport from "kaneo-plugin-time-report";',
        "",
        "export default {",
        "  plugins: [timeReport()],",
        "};",
        "",
      ),
    );
  });

  it("picks a free name when the default one is already used", () => {
    const result = addPluginToConfig(
      lines(
        'import { defineConfig } from "@kaneo/config";',
        'import timeReport from "@acme/time-report";',
        "export default defineConfig({ plugins: [timeReport()] });",
      ),
      "kaneo-plugin-time-report",
    );
    expect(result).toMatchObject({
      status: "updated",
      importName: "timeReport2",
    });
    expect(result.status === "updated" && result.source).toContain(
      "plugins: [timeReport(), timeReport2()]",
    );
  });

  it("leaves the source alone when the plugin is already listed", () => {
    expect(
      addPluginToConfig(
        lines(
          'import { defineConfig } from "@kaneo/config";',
          "import report from 'kaneo-plugin-time-report';",
          "export default defineConfig({ plugins: [report({ weekly: true })] });",
        ),
        "kaneo-plugin-time-report",
      ),
    ).toEqual({ status: "present" });
    expect(
      addPluginToConfig(
        lines(
          '// import x from "kaneo-plugin-time-report";',
          "export default { plugins: [] };",
        ),
        "kaneo-plugin-time-report",
      ).status,
    ).toBe("updated");
  });

  it("lists an imported plugin that is missing from plugins without importing it again", () => {
    const result = addPluginToConfig(
      lines(
        'import { defineConfig } from "@kaneo/config";',
        "import report from 'kaneo-plugin-time-report';",
        "export default defineConfig({});",
      ),
      "kaneo-plugin-time-report",
    );
    expect(result).toEqual({
      status: "updated",
      importName: "report",
      source: lines(
        'import { defineConfig } from "@kaneo/config";',
        "import report from 'kaneo-plugin-time-report';",
        "export default defineConfig({ plugins: [report()] });",
      ),
    });
  });

  it("asks for a manual edit when the import cannot be matched to a listed plugin", () => {
    expect(
      manualReason(
        lines(
          'import type { Options } from "kaneo-plugin-time-report";',
          "export default { plugins: [] };",
        ),
      ),
    ).toBe("it imports kaneo-plugin-time-report without a default import");

    const reused = addPluginToConfig(
      lines(
        'import report from "kaneo-plugin-time-report";',
        "const weekly = report({ weekly: true });",
        "export default { plugins: [] };",
      ),
      "kaneo-plugin-time-report",
    );
    expect(reused).toEqual({
      status: "manual",
      importName: "report",
      reason:
        "it imports kaneo-plugin-time-report as report but does not list it in plugins",
    });
  });

  it("falls back to manual instructions when it cannot edit safely", () => {
    expect(
      manualReason(
        lines(
          'import { defineConfig } from "@kaneo/config";',
          'export default defineConfig({ plugins: ["unterminated] });',
        ),
      ),
    ).toContain("never ends");
    expect(
      manualReason(
        lines(
          'const { defineConfig } = require("@kaneo/config");',
          "module.exports = defineConfig({ plugins: [] });",
        ),
      ),
    ).toBe("it uses CommonJS");
    expect(
      manualReason(
        lines(
          'import { defineConfig } from "@kaneo/config";',
          "const config = { plugins: [] };",
          "export default defineConfig(config);",
        ),
      ),
    ).toContain("not called with an object literal");
    expect(
      manualReason(
        lines(
          'import { defineConfig } from "@kaneo/config";',
          "export default defineConfig({ plugins: basePlugins });",
        ),
      ),
    ).toBe("plugins is not an array literal");
    expect(
      manualReason(
        lines(
          'import { defineConfig } from "@kaneo/config";',
          "export default defineConfig({ ...base });",
        ),
      ),
    ).toContain("spreads");
    expect(
      manualReason(
        lines(
          'import { defineConfig } from "@kaneo/config";',
          "const plugins = [];",
          "export default defineConfig({ plugins });",
        ),
      ),
    ).toBe("plugins is not a plain property");
    expect(manualReason("export default config;\n")).toContain(
      "no defineConfig",
    );
    expect(
      manualReason(
        lines(
          'import { defineConfig } from "@kaneo/config";',
          "export default defineConfig({ plugins: [a() });",
        ),
      ),
    ).toContain("brackets");
  });
});

describe("configTemplate", () => {
  it("declares the plugin with defineConfig", () => {
    expect(configTemplate("kaneo-plugin-time-report", "timeReport")).toBe(
      lines(
        'import { defineConfig } from "@kaneo/config";',
        'import timeReport from "kaneo-plugin-time-report";',
        "",
        "export default defineConfig({",
        "  plugins: [timeReport()],",
        "});",
        "",
      ),
    );
  });
});
