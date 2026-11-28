import type { PluginTask } from "@kaneo/plugin-sdk/web";

export type ScheduledTask = PluginTask & {
  scheduleStart: Date;
  scheduleEnd: Date;
};
