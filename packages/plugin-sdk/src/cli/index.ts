import { parseArgs } from "node:util";
import { buildPlugin } from "./build.js";
import { errorMessage } from "./errors.js";
import { log } from "./log.js";
import { watchPlugin } from "./watch.js";

const USAGE = `Usage: kaneo-plugin build [--watch]

Builds the Kaneo plugin in the current folder into dist/.

Options:
  -w, --watch  Rebuild when files change
  -h, --help   Show this help

Docs: https://kaneo.app/docs/core/plugins/writing-plugins`;

async function main(args: string[]): Promise<number> {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      watch: { type: "boolean", short: "w" },
      help: { type: "boolean", short: "h" },
    },
  });

  if (values.help) {
    log.info(USAGE);
    return 0;
  }

  const [command] = positionals;
  if (command !== "build") {
    log.error(command ? `Unknown command "${command}"` : "Missing command");
    log.info(USAGE);
    return 1;
  }

  if (values.watch) await watchPlugin(process.cwd());
  else await buildPlugin(process.cwd());
  return 0;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    log.error(errorMessage(error));
    process.exitCode = 1;
  },
);
