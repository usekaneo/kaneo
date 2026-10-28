import { Command } from "effect/cli";
import { timeEdit } from "./edit.js";
import { timeList } from "./list.js";
import { timeLog } from "./log.js";
import { timeStart } from "./start.js";
import { timeStatus } from "./status.js";
import { timeStop } from "./stop.js";

export const time = Command.make("time").pipe(
  Command.withDescription("Track time on tasks"),
  Command.withSubcommands([
    timeStart,
    timeStop,
    timeStatus,
    timeLog,
    timeList,
    timeEdit,
  ]),
);
