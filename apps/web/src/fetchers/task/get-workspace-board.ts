import { client } from "@kaneo/libs";
import type { InferRequestType, InferResponseType } from "hono/client";
import { HttpError } from "@/lib/http-error";
import { loadBoardPages } from "./load-board-pages";

type WorkspaceBoardRequest = InferRequestType<
  (typeof client)["task"]["workspace-board"]["$get"]
>["query"];

export type WorkspaceBoardQuery = Omit<
  WorkspaceBoardRequest,
  "workspaceId" | "page" | "limit"
>;

export type WorkspaceBoardResponse = InferResponseType<
  (typeof client)["task"]["workspace-board"]["$get"],
  200
>;

export type WorkspaceBoard = WorkspaceBoardResponse["data"] & {
  /** Matching tasks on the server, which may exceed what was loaded. */
  total: number;
};

export const WORKSPACE_BOARD_ID_PREFIX = "workspace-board:";

// Keep the merged board bounded; the toolbar tells the user to narrow filters.
export const WORKSPACE_BOARD_MAX_PAGES = 10;

// Requests in flight at once after the first page.
export const WORKSPACE_BOARD_PARALLEL_PAGES = 3;

type WorkspaceBoardPage = {
  data: WorkspaceBoard;
  pagination: {
    page: number;
    pageSize: number;
    totalPages: number;
    total: number;
  };
};

async function getWorkspaceBoard(
  workspaceId: string,
  query: WorkspaceBoardQuery,
  signal?: AbortSignal,
  onProgress?: (board: WorkspaceBoard) => void,
): Promise<WorkspaceBoard> {
  const fetchPage = async (page: number): Promise<WorkspaceBoardPage> => {
    const response = await client.task["workspace-board"].$get(
      { query: { ...query, workspaceId, page: String(page), limit: "100" } },
      { init: { signal } },
    );
    if (!response.ok) {
      throw await HttpError.fromResponse(response);
    }
    const { data, pagination } = await response.json();
    return {
      data: { ...data, total: pagination.total },
      pagination: {
        ...pagination,
        totalPages: Math.min(pagination.totalPages, WORKSPACE_BOARD_MAX_PAGES),
      },
    };
  };

  // Later pages do not depend on each other, so a few load at once. Each one
  // holds a database connection for its read, so the window stays small.
  const pending = new Map<number, Promise<WorkspaceBoardPage>>();
  let nextPage = 2;
  let lastPage = 1;
  let failed = false;
  const startNextPage = () => {
    if (failed || signal?.aborted || nextPage > lastPage) return;
    const request = fetchPage(nextPage);
    pending.set(nextPage, request);
    nextPage++;
    // Rejections surface when loadBoardPages awaits the page.
    request.then(startNextPage, () => {
      failed = true;
    });
  };
  return loadBoardPages<WorkspaceBoard>(
    async (page) => {
      if (page !== 1) return pending.get(page) ?? fetchPage(page);
      const first = await fetchPage(1);
      lastPage = first.pagination.totalPages;
      for (let slot = 0; slot < WORKSPACE_BOARD_PARALLEL_PAGES; slot++) {
        startNextPage();
      }
      return first;
    },
    signal,
    onProgress,
  );
}

export default getWorkspaceBoard;
