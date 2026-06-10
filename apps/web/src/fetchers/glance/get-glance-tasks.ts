import { getApiUrl } from "@/fetchers/get-api-url";
import type { GlanceTask } from "./types";

export async function getGlanceTasks(
  filters: Record<string, string>,
): Promise<GlanceTask[]> {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (!value) continue;
    // Comma-separated multi-select values become repeated query params
    // so the API can use req.queries() to read them as an array.
    for (const v of value.split(",")) {
      const trimmed = v.trim();
      if (trimmed) params.append(key, trimmed);
    }
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
