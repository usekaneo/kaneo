import { client } from "@kaneo/libs";
import type { InferRequestType } from "hono/client";
import { loadBoardPages } from "@/fetchers/task/load-board-pages";
import { HttpError } from "@/lib/http-error";
export type GetPublicProjectRequest = InferRequestType<
  (typeof client)["public-project"][":id"]["$get"]
>["param"];
async function getPublicProject(
  { id }: GetPublicProjectRequest,
  signal?: AbortSignal,
) {
  return loadBoardPages(async (page, relatedPage) => {
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
    return { data, pagination };
  }, signal);
}
export default getPublicProject;
