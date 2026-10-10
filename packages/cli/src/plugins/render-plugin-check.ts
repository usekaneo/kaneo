import { CONFIG_FILE_NAMES } from "@kaneo/plugin-loader";
import { sanitizeText } from "../render/sanitize.js";
import type { Ui } from "../render/ui.js";
import type { PluginCheckEntry, PluginCheckReport } from "./check-report.js";
import type { KaneoVersionSource } from "./kaneo-target.js";

const SOURCES: Record<KaneoVersionSource, string> = {
  flag: " (from --kaneo-version)",
  installation: "",
  "config-package": " (from @kaneo/config in the project)",
};

function fileList(): string {
  const names = [...CONFIG_FILE_NAMES];
  const last = names.pop();
  return `${names.join(", ")}, or ${last}`;
}

function heading(ui: Ui, report: PluginCheckReport): string[] {
  const { theme, glyphs } = ui;
  const version = `Kaneo ${report.kaneoVersion}${SOURCES[report.kaneoVersionSource]}`;
  const lines = report.configPath
    ? [`  Checking ${theme.strong(report.configPath)} against ${version}`]
    : [
        `  No ${fileList()} in ${report.projectDir}, so only the built-in plugins are checked against ${version}.`,
      ];
  if (report.configPath && report.declared === 0) {
    lines.push(`  ${theme.muted(`${report.configPath} declares no plugins.`)}`);
  }
  if (report.skippedBuiltIn.length > 0) {
    lines.push(
      `  ${theme.muted(`Built-in plugins (${report.skippedBuiltIn.join(", ")}) are only checked inside a Kaneo installation.`)}`,
    );
  }
  for (const warning of report.warnings) {
    lines.push(`  ${theme.warning(glyphs.warning)} ${sanitizeText(warning)}`);
  }
  return lines;
}

function entryLines(ui: Ui, entry: PluginCheckEntry): string[] {
  const { theme, glyphs } = ui;
  if (entry.status === "ok") {
    const builtIn = entry.official
      ? ` ${theme.muted(`${glyphs.separator} built in`)}`
      : "";
    return [
      `  ${theme.success(glyphs.tick)} ${theme.strong(sanitizeText(entry.id))} ${sanitizeText(entry.version)}${builtIn}`,
    ];
  }
  const name = sanitizeText(entry.packageName ?? "plugin");
  return [
    `  ${theme.danger(glyphs.cross)} Plugin "${name}" failed at ${entry.stage}:`,
    ...sanitizeText(entry.message)
      .split("\n")
      .map((line) => `    ${line}`),
    `    ${theme.muted(`${glyphs.arrow} ${sanitizeText(entry.hint)}`)}`,
  ];
}

function summary(ui: Ui, report: PluginCheckReport): string {
  const { theme, glyphs } = ui;
  const total = report.plugins.length;
  if (report.failed > 0) {
    return `  ${theme.danger(glyphs.cross)} ${theme.strong(`${report.failed} of ${total} plugins failed.`)} Kaneo would stop at startup with this config.`;
  }
  if (total === 0) return `  ${theme.muted("There are no plugins to check.")}`;
  return `  ${theme.success(glyphs.tick)} ${theme.strong(total === 1 ? "The plugin passed the startup checks." : `All ${total} plugins passed the startup checks.`)}`;
}

export function renderPluginCheck(ui: Ui, report: PluginCheckReport): string[] {
  const entries = report.plugins.flatMap((entry) => entryLines(ui, entry));
  return [
    "",
    ...heading(ui, report),
    "",
    ...(entries.length > 0 ? [...entries, ""] : []),
    summary(ui, report),
    "",
  ];
}
