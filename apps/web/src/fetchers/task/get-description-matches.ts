import { client } from "@kaneo/libs";
import { HttpError } from "@/lib/http-error";

export async function getDescriptionMatches(
  projectId: string,
  query: string,
  signal?: AbortSignal,
) {
  const ids = new Set<string>();
  let after: string | undefined;
  while (true) {
    signal?.throwIfAborted();
    const response = await client.task["description-matches"][
      ":projectId"
    ].$get(
      { param: { projectId }, query: { query, after } },
      { init: { signal } },
    );
    if (!response.ok)
      throw new HttpError(response.status, "Failed to search descriptions");
    const page = await response.json();
    for (const id of page.ids) ids.add(id);
    if (page.nextCursor === null) break;
    if (page.nextCursor === after || page.ids.length === 0)
      throw new Error("Description search did not advance");
    after = page.nextCursor;
  }
  signal?.throwIfAborted();
  return Array.from(ids);
}
