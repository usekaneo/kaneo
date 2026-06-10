import { getApiUrl } from "@/fetchers/get-api-url";
import type { GlanceMember } from "./types";

export async function getGlanceMembers(): Promise<GlanceMember[]> {
  const response = await fetch(getApiUrl("/glance/members"), {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  const data = (await response.json()) as { members: GlanceMember[] };
  return data.members;
}
