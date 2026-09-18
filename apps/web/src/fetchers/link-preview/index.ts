import { client } from "@kaneo/libs";
import type { InferResponseType } from "hono/client";

export type LinkPreview = NonNullable<
  InferResponseType<(typeof client)["link-preview"]["$get"], 200>
>;

export async function getLinkPreview(workspaceId: string, url: string) {
  const response = await client["link-preview"].$get({
    query: { workspaceId, url },
  });
  // A preview is decoration: any failure just means no card.
  if (!response.ok) return null;
  return response.json();
}
