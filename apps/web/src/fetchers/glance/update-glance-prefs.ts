import { getApiUrl } from "@/fetchers/get-api-url";
import type { GlancePrefs } from "./types";

export async function updateGlancePrefs(
  prefs: Partial<GlancePrefs>,
): Promise<GlancePrefs> {
  const response = await fetch(getApiUrl("/glance/prefs"), {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(prefs),
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<GlancePrefs>;
}
