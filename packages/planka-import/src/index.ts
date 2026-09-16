#!/usr/bin/env node
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import prompts from "prompts";
import { DEFAULT_KANEO_URL, HELP_TEXT, parseArgs } from "./args.js";
import { KaneoClient } from "./kaneo.js";
import { type BoardReport, type BoardTarget, migrate } from "./migrate.js";
import { PlankaClient } from "./planka.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    process.stdout.write(HELP_TEXT);
    return 0;
  }

  if (args.version) {
    process.stdout.write(`${version}\n`);
    return 0;
  }

  const interactive = process.stdin.isTTY === true;

  const plankaUrl =
    args.plankaUrl ??
    (await ask(interactive, {
      type: "text",
      name: "value",
      message: "PLANKA instance URL",
    }));
  if (!plankaUrl) throw new Error("--planka-url is required");

  const plankaApiKey = args.plankaApiKey ?? process.env.PLANKA_API_KEY;

  const planka = new PlankaClient({
    baseUrl: plankaUrl,
    ...(args.plankaToken ? { token: args.plankaToken } : {}),
    ...(plankaApiKey ? { apiKey: plankaApiKey } : {}),
  });

  if (!planka.isAuthenticated) {
    const user =
      args.plankaUser ??
      (await ask(interactive, {
        type: "text",
        name: "value",
        message: "PLANKA email or username",
      }));
    if (!user) throw new Error("--planka-user is required");

    const password =
      args.plankaPassword ??
      process.env.PLANKA_PASSWORD ??
      (await ask(interactive, {
        type: "password",
        name: "value",
        message: "PLANKA password",
      }));
    if (!password) throw new Error("--planka-password is required");

    await planka.login(user, password);
    log("Authenticated with PLANKA");
  }

  const bundle = await planka.listProjects();
  const boards = bundle.included.boards ?? [];
  const boardCounts = new Map<string, number>();
  for (const board of boards) {
    boardCounts.set(
      board.projectId,
      (boardCounts.get(board.projectId) ?? 0) + 1,
    );
  }

  const allTargets: BoardTarget[] = [];
  for (const project of bundle.items) {
    for (const board of boards.filter((b) => b.projectId === project.id)) {
      allTargets.push({
        project,
        board,
        boardCountInProject: boardCounts.get(project.id) ?? 1,
      });
    }
  }

  if (allTargets.length === 0) {
    log("No boards found in PLANKA for this account.");
    return 0;
  }

  const targets = await selectTargets(allTargets, args, interactive);
  if (targets.length === 0) {
    log("Nothing selected.");
    return 0;
  }

  const kaneoApiKey = args.kaneoApiKey ?? process.env.KANEO_API_KEY;
  if (!kaneoApiKey && !args.dryRun) {
    throw new Error(
      "A Kaneo API key is required. Pass --kaneo-api-key or set KANEO_API_KEY.",
    );
  }

  const kaneo = new KaneoClient({
    baseUrl: args.kaneoUrl ?? DEFAULT_KANEO_URL,
    apiKey: kaneoApiKey ?? "",
  });

  let workspaceId = args.workspace ?? "";
  if (!args.dryRun && !workspaceId) {
    workspaceId = await selectWorkspace(kaneo, interactive);
  }

  const preview = await migrate({
    planka,
    kaneo,
    workspaceId,
    targets,
    dryRun: true,
    skipComments: args.skipComments,
    onProgress: () => {},
  });

  printPlan(preview);

  if (args.dryRun) {
    await writeReport(args.report, preview);
    log("Dry run. Nothing was written to Kaneo.");
    return 0;
  }

  if (!args.yes) {
    const confirmed = await confirm(
      interactive,
      `Import ${targets.length} board(s) into Kaneo workspace ${workspaceId}?`,
    );
    if (!confirmed) {
      log("Aborted.");
      return 1;
    }
  }

  const reports = await migrate({
    planka,
    kaneo,
    workspaceId,
    targets,
    dryRun: false,
    skipComments: args.skipComments,
    ...(args.icon ? { projectIcon: args.icon } : {}),
    onProgress: progress,
  });

  clearProgress();
  printResults(reports);
  await writeReport(args.report, reports);

  return reports.some((report) => report.failed) ? 1 : 0;
}

async function selectTargets(
  allTargets: BoardTarget[],
  args: ReturnType<typeof parseArgs>,
  interactive: boolean,
): Promise<BoardTarget[]> {
  if (args.projects.length > 0) {
    const wanted = args.projects.map((value) => value.toLowerCase());
    const matched = allTargets.filter(
      (target) =>
        wanted.includes(target.project.name.toLowerCase()) ||
        wanted.includes(target.project.id.toLowerCase()),
    );

    if (matched.length === 0) {
      throw new Error(
        `No PLANKA project matched: ${args.projects.join(", ")}. Available: ${[
          ...new Set(allTargets.map((target) => target.project.name)),
        ].join(", ")}`,
      );
    }
    return matched;
  }

  if (args.all || !interactive) return allTargets;

  const answer = await prompts({
    type: "multiselect",
    name: "value",
    message: "Select boards to migrate",
    instructions: false,
    choices: allTargets.map((target) => ({
      title: `${target.project.name} › ${target.board.name}`,
      value: target,
      selected: true,
    })),
  });

  return (answer.value as BoardTarget[] | undefined) ?? [];
}

async function selectWorkspace(
  kaneo: KaneoClient,
  interactive: boolean,
): Promise<string> {
  const workspaces = await kaneo.listWorkspaces();

  if (workspaces.length === 0) {
    throw new Error("This Kaneo account has no workspaces.");
  }

  const first = workspaces[0];
  if (workspaces.length === 1 && first) return first.id;

  if (!interactive) {
    throw new Error(
      `Several workspaces are available; pass --workspace with one of: ${workspaces
        .map((workspace) => `${workspace.name} (${workspace.id})`)
        .join(", ")}`,
    );
  }

  const answer = await prompts({
    type: "select",
    name: "value",
    message: "Target Kaneo workspace",
    choices: workspaces.map((workspace) => ({
      title: workspace.name,
      value: workspace.id,
    })),
  });

  const chosen = answer.value as string | undefined;
  if (!chosen) throw new Error("No workspace selected.");
  return chosen;
}

function printPlan(reports: BoardReport[]): void {
  log("");
  log("Planned import:");
  for (const report of reports) {
    if (report.failed) {
      log(`  ✖ ${report.projectName}: ${report.error}`);
      continue;
    }
    log(
      `  • ${report.projectName}  ${report.columns} columns  ${report.tasks} tasks  ${report.labels} labels  ${report.comments} comments`,
    );
    for (const warning of report.warnings) log(`      ! ${warning}`);
    if (report.skippedLists.length > 0) {
      log(
        `      - skipping ${report.skippedLists.join(", ")} (archive/trash lists are not migrated)`,
      );
    }
    if (report.skippedAttachments > 0) {
      log(
        `      - ${report.skippedAttachments} attachment(s) will not be migrated`,
      );
    }
  }
  log("");
}

function printResults(reports: BoardReport[]): void {
  log("");
  for (const report of reports) {
    if (report.failed) {
      log(`✖ ${report.projectName}: ${report.error}`);
      continue;
    }
    log(
      `✔ ${report.projectName} (${report.projectKey})  ${report.columns} columns  ${report.tasks} tasks  ${report.labels} labels  ${report.comments} comments  ${report.assignees} assignees`,
    );
  }

  const failed = reports.filter((report) => report.failed).length;
  log("");
  log(
    failed > 0
      ? `Finished with ${failed} failed board(s).`
      : "Finished. Everything imported.",
  );
}

async function writeReport(
  path: string | undefined,
  reports: BoardReport[],
): Promise<void> {
  if (!path) return;
  await writeFile(path, `${JSON.stringify(reports, null, 2)}\n`, "utf8");
  log(`Report written to ${path}`);
}

let progressActive = false;

function progress(message: string): void {
  if (!process.stdout.isTTY) return;
  process.stdout.write(`\r\u001B[2K${message}`);
  progressActive = true;
}

function clearProgress(): void {
  if (progressActive && process.stdout.isTTY) {
    process.stdout.write("\r\u001B[2K");
    progressActive = false;
  }
}

function log(message: string): void {
  clearProgress();
  process.stdout.write(`${message}\n`);
}

async function ask(
  interactive: boolean,
  question: prompts.PromptObject,
): Promise<string | undefined> {
  if (!interactive) return undefined;
  const answer = await prompts(question);
  const value = answer.value as string | undefined;
  return value?.trim() || undefined;
}

async function confirm(
  interactive: boolean,
  message: string,
): Promise<boolean> {
  if (!interactive) return true;
  const answer = await prompts({
    type: "confirm",
    name: "value",
    message,
    initial: true,
  });
  return answer.value === true;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    clearProgress();
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  });
