import { getApiUrl } from "@/fetchers/get-api-url";
import type { GlanceFilters } from "./types";

export async function getGlanceFilters(): Promise<GlanceFilters> {
  const response = await fetch(getApiUrl("/glance/filters"), {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<GlanceFilters>;
}
