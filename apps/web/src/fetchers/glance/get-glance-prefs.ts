import { getApiUrl } from "@/fetchers/get-api-url";
import type { GlancePrefs } from "./types";

export async function getGlancePrefs(): Promise<GlancePrefs> {
  const response = await fetch(getApiUrl("/glance/prefs"), {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<GlancePrefs>;
}
