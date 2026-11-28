import type { PluginTask } from "@kaneo/plugin-sdk/web";

export function countLayoutTasks(
  tasks: readonly PluginTask[],
  countsTask: ((task: PluginTask) => boolean) | undefined,
): number {
  if (!countsTask) return tasks.length;
  try {
    return tasks.filter((task) => countsTask(task)).length;
  } catch (error) {
    console.error("A plugin's countsTask failed", error);
    return tasks.length;
  }
}
