import { getApiUrl } from "@/fetchers/get-api-url";
import type { GlancePrefs } from "./types";

export async function deleteGlanceView(viewId: string): Promise<GlancePrefs> {
  const response = await fetch(
    getApiUrl(`/glance/views/${encodeURIComponent(viewId)}`),
    {
      method: "DELETE",
      credentials: "include",
    },
  );

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return response.json() as Promise<GlancePrefs>;
}
