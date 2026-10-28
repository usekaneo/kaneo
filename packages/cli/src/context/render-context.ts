import {
  type Cell,
  cellWidth,
  fitCell,
  renderCell,
  text,
} from "../render/cell.js";
import type { Ui } from "../render/ui.js";
import type { ContextReport } from "./context-report.js";

type Row = {
  readonly label: string;
  readonly value: Cell;
  readonly source: string;
};

const COLOR_NAMES = ["no color", "16 colors", "256 colors", "truecolor"];

const CONFIG_STATUS = {
  ok: "",
  missing: "not created yet",
  foreign: "written by another kaneo CLI",
  invalid: "invalid",
  io: "unreadable",
} as const;

function profileLabel(report: ContextReport): string {
  return `profile ${report.profile.name}`;
}

function serverSource(report: ContextReport): string {
  switch (report.server.source) {
    case "flag":
      return "--api-url";
    case "env":
      return "KANEO_API_URL";
    case "profile":
      return profileLabel(report);
    case "default":
      return "default";
  }
}

function webSource(report: ContextReport): string {
  switch (report.web.source) {
    case "env":
      return "KANEO_WEB_URL";
    case "profile":
      return profileLabel(report);
    case "server":
      return "same as the server";
  }
}

function profileSource(report: ContextReport): string {
  switch (report.profile.source) {
    case "flag":
      return "--profile";
    case "env":
      return "KANEO_PROFILE";
    case "config":
      return "active in the config file";
    case "default":
      return "default";
  }
}

function authSource(report: ContextReport): string {
  switch (report.auth.source) {
    case "flag":
      return "--token";
    case "env":
      return "KANEO_API_KEY";
    case "profile":
      return profileLabel(report);
    case "none":
      return "";
  }
}

function workspaceSource(report: ContextReport): string {
  switch (report.workspace.source) {
    case "flag":
      return "-w";
    case "env":
      return "KANEO_WORKSPACE";
    case "repo":
      return report.workspace.path ?? ".kaneo.json";
    case "profile":
      return profileLabel(report);
    case "none":
      return "";
  }
}

function projectSource(report: ContextReport): string {
  switch (report.project.source) {
    case "env":
      return "KANEO_PROJECT";
    case "repo":
      return report.project.path ?? ".kaneo.json";
    case "none":
      return "";
  }
}

function outputSource(report: ContextReport): string {
  switch (report.output.source) {
    case "flag":
      return report.output.mode === "json" ? "--json" : "--human";
    case "env":
      return "KANEO_JSON";
    case "terminal":
      return "stdout is a terminal";
    case "pipe":
      return "stdout is not a terminal";
  }
}

function profileValue(ui: Ui, report: ContextReport): Cell {
  const { theme, glyphs } = ui;
  const { profile } = report;
  if (!profile.stored) {
    return [
      text(profile.name),
      text(` ${glyphs.separator} not stored`, theme.muted),
    ];
  }
  if (!profile.matchesServer) {
    return [
      text(profile.name),
      text(` ${glyphs.separator} stored for another server`, theme.warning),
    ];
  }
  return [text(profile.name)];
}

function authValue(ui: Ui, report: ContextReport): Cell {
  const { theme, glyphs } = ui;
  const { auth } = report;
  if (auth.method === null) return [text("signed out", theme.muted)];
  const label =
    auth.method === "token"
      ? "access token"
      : auth.method === "api-key"
        ? "API key"
        : "stored login";
  return [
    text(label),
    ...(auth.fingerprint
      ? [text(` ${glyphs.ellipsis}${auth.fingerprint}`, theme.muted)]
      : []),
  ];
}

function userValue(ui: Ui, report: ContextReport): Cell {
  const { theme, glyphs } = ui;
  if (report.user) {
    return [
      text(report.user.name, theme.strong),
      text(` ${glyphs.separator} ${report.user.email}`, theme.muted),
    ];
  }
  if (report.auth.error) {
    return [text(`${glyphs.cross} ${report.auth.error}`, theme.danger)];
  }
  return [text("unknown", theme.muted)];
}

function workspaceValue(ui: Ui, report: ContextReport): Cell {
  const { theme } = ui;
  const { workspace } = report;
  if (!workspace.id) return [text("none selected", theme.muted)];
  if (!workspace.name) return [text(workspace.id)];
  return [text(workspace.name), text(` ${workspace.id}`, theme.muted)];
}

function projectValue(ui: Ui, report: ContextReport): Cell {
  const { theme } = ui;
  const { project } = report;
  if (!project.ref) return [text("none selected", theme.muted)];
  if (!project.name) return [text(project.ref)];
  return [
    text(project.name),
    text(` ${project.key ?? project.ref}`, theme.muted),
  ];
}

function terminalValue(ui: Ui, report: ContextReport): Cell {
  const { theme, glyphs } = ui;
  const caps = report.output.terminal;
  const parts = [
    COLOR_NAMES[caps.color] ?? "no color",
    caps.unicode ? "unicode" : "ascii",
    caps.hyperlinks ? "hyperlinks" : "no hyperlinks",
    `${caps.columns} columns`,
  ];
  return [text(parts.join(` ${glyphs.separator} `), theme.muted)];
}

export function contextRows(ui: Ui, report: ContextReport): ReadonlyArray<Row> {
  const outputMode = report.output.jq
    ? `${report.output.mode} ${ui.glyphs.separator} jq ${report.output.jq}`
    : report.output.mode;
  return [
    {
      label: "Server",
      value: [text(report.server.url)],
      source: serverSource(report),
    },
    {
      label: "Web app",
      value: [text(report.web.url)],
      source: webSource(report),
    },
    {
      label: "Profile",
      value: profileValue(ui, report),
      source: profileSource(report),
    },
    { label: "Auth", value: authValue(ui, report), source: authSource(report) },
    { label: "User", value: userValue(ui, report), source: "" },
    {
      label: "Workspace",
      value: workspaceValue(ui, report),
      source: workspaceSource(report),
    },
    {
      label: "Project",
      value: projectValue(ui, report),
      source: projectSource(report),
    },
    {
      label: "Config",
      value: [text(report.config.path)],
      source: CONFIG_STATUS[report.config.status],
    },
    {
      label: "Output",
      value: [text(outputMode)],
      source: outputSource(report),
    },
    {
      label: "Terminal",
      value: terminalValue(ui, report),
      source: report.output.interactive ? "interactive" : "not interactive",
    },
  ];
}

export function renderContext(ui: Ui, report: ContextReport): string[] {
  const { theme, glyphs } = ui;
  const rows = contextRows(ui, report);
  const labelWidth = Math.max(...rows.map((row) => row.label.length));
  const lineWidth = Math.max(20, ui.caps.columns - 2);
  const valueLimit = Math.floor((lineWidth - labelWidth - 2) * 0.6);
  const valueWidth = Math.max(
    0,
    ...rows
      .filter((row) => row.source)
      .map((row) => cellWidth(row.value))
      .filter((width) => width <= valueLimit),
  );
  return [
    "",
    ...rows.map((row) => {
      const gap = Math.max(0, valueWidth - cellWidth(row.value));
      const cell: Cell = [
        text(row.label.padEnd(labelWidth), theme.muted),
        text("  "),
        ...row.value,
        ...(row.source
          ? [text(" ".repeat(gap + 2)), text(row.source, theme.muted)]
          : []),
      ];
      return `  ${renderCell(fitCell(cell, lineWidth, glyphs.ellipsis), ui)}`;
    }),
    "",
  ];
}
