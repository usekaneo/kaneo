import { getApiUrl } from "@/fetchers/get-api-url";
import type { GlanceFilterState, GlancePrefs } from "./types";

export async function createGlanceView(
  name: string,
  state: GlanceFilterState,
): Promise<GlancePrefs> {
  const response = await fetch(getApiUrl("/glance/views"), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      filters: state.filters,
      groupBy: state.groupBy,
    }),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<GlancePrefs>;
}
