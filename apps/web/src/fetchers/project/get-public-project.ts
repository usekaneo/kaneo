import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono/client";
import { loadBoardPages } from "@/fetchers/task/load-board-pages";
import { HttpError } from "@/lib/http-error";
export type GetPublicProjectRequest = InferRequestType<
  (typeof client)["public-project"][":id"]["$get"]
>["param"];
class BoardChanged extends Error {}
async function getPublicProject(
  { id }: GetPublicProjectRequest,
  signal?: AbortSignal,
  onProgress?: (
    board: Omit<
      InferResponseType<(typeof client)["public-project"][":id"]["$get"], 200>,
      "pagination"
    >,
  ) => void,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let revision: string | undefined;
    const relatedRevisions = new Map<number, string | undefined>();
    try {
      return await loadBoardPages(
        async (page, relatedPage) => {
          const response = await client["public-project"][":id"].$get(
            {
              param: { id },
              query: {
                page: String(page),
                limit: "100",
                ...(relatedPage ? { relatedPage: String(relatedPage) } : {}),
              },
            },
            { init: { signal } },
          );
          if (!response.ok)
            throw new HttpError(response.status, await response.text());
          const { pagination, ...data } = await response.json();
          if (page === 1 && !relatedPage) revision = pagination.revision;
          else if (revision !== undefined && pagination.revision !== revision)
            throw new BoardChanged();
          if (!relatedPage)
            relatedRevisions.set(page, pagination.relatedRevision);
          else if (relatedRevisions.get(page) !== pagination.relatedRevision)
            throw new BoardChanged();
          return { data, pagination };
        },
        signal,
        onProgress,
      );
    } catch (error) {
      if (!(error instanceof BoardChanged) || attempt === 2) throw error;
      signal?.throwIfAborted();
    }
  }
  throw new BoardChanged();
}
export default getPublicProject;
