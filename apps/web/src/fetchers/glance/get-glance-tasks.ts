import { getApiUrl } from "@/fetchers/get-api-url";
import type { GlanceTask } from "./types";

export async function getGlanceTasks(
  filters: Record<string, string>,
): Promise<GlanceTask[]> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (!value) continue;
    params.set(key, value);
  }

  const response = await fetch(
    getApiUrl(`/glance/tasks?${params.toString()}`),
    { credentials: "include" },
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = (await response.json()) as { tasks: GlanceTask[] };
  return data.tasks;
}
