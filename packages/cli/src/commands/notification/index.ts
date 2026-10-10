import { Command } from "effect/cli";
import { notificationList } from "./list.js";
import { notificationRead } from "./read.js";

export const notification = Command.make("notification").pipe(
  Command.withDescription("Read your notifications"),
  Command.withAlias("inbox"),
  Command.withSubcommands([notificationList, notificationRead]),
);
