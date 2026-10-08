import { parseArgs } from "node:util";
import { errorMessage } from "../plugin-host/load-error";
import { CliError } from "./cli-error";
import type { HelpTopic } from "./help";

export type CliCommand =
  | { name: "version" }
  | { name: "help"; topic: HelpTopic }
  | { name: "check"; project?: string; config?: string }
  | { name: "add"; packageName: string; yes: boolean; project?: string }
  | {
      name: "purge";
      pluginId: string;
      yes: boolean;
      project?: string;
      config?: string;
    };

const HELP_FLAGS = new Set(["--help", "-h", "help"]);

function withUsage<T>(topic: HelpTopic, parse: () => T): T {
  try {
    return parse();
  } catch (error) {
    throw new CliError(
      `${errorMessage(error)}\nRun "kaneo ${topic} --help" for usage.`,
    );
  }
}

function single(positionals: string[], topic: HelpTopic, what: string): string {
  const [value] = positionals;
  if (positionals.length !== 1 || value === undefined) {
    throw new CliError(
      `"kaneo ${topic}" takes exactly one ${what}.\nRun "kaneo ${topic} --help" for usage.`,
    );
  }
  return value;
}

function parseCheck(args: string[]): CliCommand {
  const { values } = withUsage("check", () =>
    parseArgs({
      args,
      options: {
        config: { type: "string" },
        project: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
      strict: true,
    }),
  );
  if (values.help) return { name: "help", topic: "check" };
  return { name: "check", project: values.project, config: values.config };
}

function parseAdd(args: string[]): CliCommand {
  const { values, positionals } = withUsage("add", () =>
    parseArgs({
      args,
      options: {
        yes: { type: "boolean", short: "y" },
        project: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
      allowPositionals: true,
      strict: true,
    }),
  );
  if (values.help) return { name: "help", topic: "add" };
  return {
    name: "add",
    packageName: single(positionals, "add", "package name"),
    yes: values.yes ?? false,
    project: values.project,
  };
}

function parsePurge(args: string[]): CliCommand {
  const { values, positionals } = withUsage("plugin purge", () =>
    parseArgs({
      args,
      options: {
        yes: { type: "boolean", short: "y" },
        config: { type: "string" },
        project: { type: "string" },
        help: { type: "boolean", short: "h" },
      },
      allowPositionals: true,
      strict: true,
    }),
  );
  if (values.help) return { name: "help", topic: "plugin purge" };
  return {
    name: "purge",
    pluginId: single(positionals, "plugin purge", "plugin id"),
    yes: values.yes ?? false,
    project: values.project,
    config: values.config,
  };
}

function parsePlugin(args: string[]): CliCommand {
  const [subcommand, ...rest] = args;
  if (subcommand === undefined || HELP_FLAGS.has(subcommand)) {
    return { name: "help", topic: "plugin" };
  }
  if (subcommand === "purge") return parsePurge(rest);
  throw new CliError(
    `Unknown command "kaneo plugin ${subcommand}".\nRun "kaneo plugin --help" for usage.`,
  );
}

export function parseCli(argv: readonly string[]): CliCommand {
  const [command, ...rest] = argv;
  if (command === undefined || HELP_FLAGS.has(command)) {
    return { name: "help", topic: "kaneo" };
  }
  if (command === "--version" || command === "-v") return { name: "version" };
  switch (command) {
    case "check":
      return parseCheck(rest);
    case "add":
      return parseAdd(rest);
    case "plugin":
      return parsePlugin(rest);
    default:
      throw new CliError(
        `Unknown command "${command}".\nRun "kaneo --help" for the list of commands.`,
      );
  }
}
