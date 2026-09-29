import { client } from "@kaneo/libs";
import type { ProjectWithTasks } from "@/types/project";
import { HttpError } from "@/lib/http-error";
import { loadBoardPages } from "./load-board-pages";

async function getTasks(
  projectId: string,
  signal?: AbortSignal,
  onProgress?: (board: ProjectWithTasks) => void,
) {
  return loadBoardPages(
    async (page, relatedPage) => {
      const response = await client.task.tasks[":projectId"].$get(
        {
          param: { projectId },
          query: {
            page: String(page),
            limit: "100",
            ...(relatedPage ? { relatedPage: String(relatedPage) } : {}),
          },
        },
        { init: { signal } },
      );
      if (!response.ok)
        throw new HttpError(response.status, "Failed to fetch tasks");
      return response.json();
    },
    signal,
    onProgress,
  );
}
export default getTasks;
